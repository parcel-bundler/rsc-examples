import type {Asset, Dependency, NamedBundle, BundleGraph, Blob, Async} from '@parcel/types';
import type {Page} from './types';
import {Packager} from '@parcel/plugin';
// @ts-ignore
import {PromiseQueue, urlJoin, blobToString} from '@parcel/utils';
import Module from 'module';
import path from 'path';
import vm from 'vm';
// @ts-ignore
import {ResolverBase} from '@parcel/node-resolver-core';
import fs from 'fs';

interface ParcelModule extends Pick<Module, 'exports' | 'children' | 'filename' | 'id' | 'path'> {}

let clientResolver: ResolverBase;
let serverResolver: ResolverBase;
let packagingBundles = new Map<NamedBundle, Async<{contents: Blob}>>();
let moduleCache = new Map<string, ParcelModule>();
let loadedBundles = new Map<NamedBundle, ReturnType<typeof loadBundleUncached>>();

export default new Packager({
  loadConfig({options}) {
    packagingBundles.clear();
    moduleCache.clear();
    loadedBundles.clear();
    clientResolver = new ResolverBase(options.projectRoot, {
      mode: 2,
      packageExports: true,
    });
    
    serverResolver = new ResolverBase(options.projectRoot, {
      mode: 2,
      packageExports: true,
      conditions: 1 << 16 // "react-server"
    });
  },
  async package({bundle, bundleGraph, getInlineBundleContents}) {
    if (bundle.env.shouldScopeHoist) {
      throw new Error('Scope hoisting is not supported with SSG');
    }

    let {load, loadModule} = await loadBundle(bundle, bundleGraph, getInlineBundleContents);

    let Component = load(bundle.getMainEntry()!.id).default;
    let {renderToReadableStream} = loadModule('react-server-dom-parcel/server.edge', __filename, 'react-server');
    let {prerender} = loadModule('react-dom/static.edge', __filename, 'react-client');
    let React = loadModule('react', __filename, 'react-client');
    let {createFromReadableStream} = loadModule('react-server-dom-parcel/client.edge', __filename, 'react-client');
    let {injectRSCPayload} = await import('rsc-html-stream/server');

    let pages: Page[] = [];
    bundleGraph.traverseBundles(b => {
      let main = b.getMainEntry();
      if (main && b.type === 'js' && b.needsStableName) {
        pages.push({
          url: urlJoin(b.target.publicUrl, b.name),
          name: b.name,
          meta: main.meta
        });
      }
    }, null);

    let props = {
      pages,
      currentPage: {
        url: urlJoin(bundle.target.publicUrl, bundle.name),
        name: bundle.name,
        meta: bundle.getMainEntry()!.meta
      } satisfies Page
    };

    let stream = renderToReadableStream(React.createElement(Component, props));

    let [s1, s2] = stream.tee();
    let data = createFromReadableStream(s1);
    function Content() {
      return React.use(data);
    }

    let {prelude} = await prerender(React.createElement(Content));
    let response = prelude.pipeThrough(injectRSCPayload(s2));
    let contents = '';
    for await (let chunk of response) {
      contents += Buffer.from(chunk).toString('utf8');
    }

    return {
      contents
    };
  }
});

function loadBundle(
  bundle: NamedBundle,
  bundleGraph: BundleGraph<NamedBundle>,
  getInlineBundleContents: (bundle: NamedBundle, bundleGraph: BundleGraph<NamedBundle>) => Async<{contents: Blob}>
) {
  let cached = loadedBundles.get(bundle);
  if (!cached) {
    cached = loadBundleUncached(bundle, bundleGraph, getInlineBundleContents);
    loadedBundles.set(bundle, cached);
  }
  
  return cached;
}

async function loadBundleUncached(
  bundle: NamedBundle,
  bundleGraph: BundleGraph<NamedBundle>,
  getInlineBundleContents: (bundle: NamedBundle, bundleGraph: BundleGraph<NamedBundle>) => Async<{contents: Blob}>
) {
  let queue = new PromiseQueue({maxConcurrent: 32});
  bundle.traverse(node => {
    if (node.type === 'dependency') {
      let dep = node.value;
      let entryBundle = bundleGraph.getReferencedBundle(dep, bundle);
      if (entryBundle?.bundleBehavior === 'inline') {
        queue.add(async () => {
          if (!packagingBundles.has(entryBundle)) {
            packagingBundles.set(entryBundle, getInlineBundleContents(
              entryBundle,
              bundleGraph
            ));
          }

          let packagedBundle = await packagingBundles.get(entryBundle)!;
          let contents = await blobToString(packagedBundle.contents);
          contents = `module.exports = ${contents}`;
          return [entryBundle.id, [entryBundle.getMainEntry(), contents]];
        });
      }
    } else if (node.type === 'asset') {
      let asset = node.value;
      queue.add(async () => [asset.id, [asset, await asset.getCode()]]);
    }
  });

  let assets = new Map<string, [Asset, string]>(await queue.run());
  let assetsByFilePath = new Map<string, string>();
  let assetsByPublicId = new Map<string, string>();
  for (let [asset] of assets.values()) {
    assetsByFilePath.set(getCacheKey(asset), asset.id);
    assetsByPublicId.set(bundleGraph.getAssetPublicId(asset), asset.id);
  }

  let loadAsset = (id: string) => {
    let [asset, code] = assets.get(id)!;
    let cacheKey = getCacheKey(asset);
    let cachedModule = moduleCache.get(cacheKey);
    if (cachedModule) {
      return cachedModule.exports;
    }

    let deps = new Map();
    for (let dep of bundleGraph.getDependencies(asset)) {
      if (bundleGraph.isDependencySkipped(dep)) {
        deps.set(getSpecifier(dep), {skipped: true});
        continue;
      }

      let entryBundle = bundleGraph.getReferencedBundle(dep, bundle);
      if (entryBundle?.bundleBehavior === 'inline') {
        deps.set(getSpecifier(dep), {id: entryBundle.id});
        continue;
      }

      let resolved = bundleGraph.getResolvedAsset(dep, bundle);
      if (resolved) {
        if (resolved.type !== 'js') {
          deps.set(getSpecifier(dep), {skipped: true});
        } else {
          deps.set(getSpecifier(dep), {id: resolved.id});
        }
      } else {
        deps.set(getSpecifier(dep), {specifier: dep.specifier});
      }
    }

    let defaultRequire = Module.createRequire(asset.filePath);
    let require = (id: string) => {
      let resolution = deps.get(id);
      if (resolution?.skipped) {
        return {};
      }

      if (resolution?.id) {
        return loadAsset(resolution.id);
      }

      if (resolution?.specifier) {
        id = resolution.specifier;
      }

      return defaultRequire(id);
    };

    // @ts-ignore
    require.resolve = defaultRequire.resolve;

    return runModule(
      code,
      asset.filePath,
      cacheKey,
      require,
      parcelRequire
    );
  };

  let parcelRequire = (publicId: string) => {
    return loadAsset(assetsByPublicId.get(publicId)!);
  };

  // @ts-ignore
  parcelRequire.meta = {
    distDir: bundle.target.distDir,
    publicUrl: bundle.target.publicUrl
  };

  // @ts-ignore
  parcelRequire.load = async (filePath: string) => {
    let bundle = bundleGraph.getBundles().find(b => b.name === filePath);
    if (bundle) {
      let {assets: subAssets} = await loadBundle(bundle, bundleGraph, getInlineBundleContents);
      for (let [id, [asset, code]] of subAssets) {
        if (!assets.has(id)) {
          assets.set(id, [asset, code]);
          assetsByFilePath.set(getCacheKey(asset), asset.id);
          assetsByPublicId.set(bundleGraph.getAssetPublicId(asset), asset.id);
        }
      }
    } else {
      throw new Error('Bundle not found');
    }
  }

  let loadModule = (id: string, from: string, env = 'react-client') => {
    let resolver = env === 'react-server' ? serverResolver : clientResolver;
    let res = resolver.resolve({
      filename: id,
      specifierType: 'commonjs',
      parent: from
    });

    if (res.error) {
      throw new Error(`Could not resolve module "${id}" from "${from}"`);
    }

    let defaultRequire = Module.createRequire(from);
    if (res.resolution.type === 'Builtin') {
      return defaultRequire(res.resolution.value);
    }

    if (res.resolution.type === 'Path') {
      let cacheKey = res.resolution.value + '#' + env;
      const cachedModule = moduleCache.get(cacheKey);
      if (cachedModule) {
        return cachedModule.exports;
      }

      let assetId = assetsByFilePath.get(cacheKey);
      if (assetId) {
        return loadAsset(assetId);
      }

      let code = fs.readFileSync(res.resolution.value, 'utf8');
      let require = (id: string) => {
        return loadModule(id, res.resolution.value, env);
      };

      // @ts-ignore
      require.resolve = defaultRequire.resolve;

      return runModule(
        code,
        res.resolution.value,
        cacheKey,
        require,
        parcelRequire
      );
    }

    throw new Error('Unknown resolution');
  };

  return {load: loadAsset, loadModule, assets};
}

function runModule(
  code: string,
  filename: string,
  id: string,
  require: (id: string) => any,
  parcelRequire: (id: string) => any
) {
  // Node's vm module still doesn't support dynamic import without --experimental-vm-modules.
  code = code.replace(/import\((parcelRequire.+)\)/g, 'parcelRequire.loadBundle($1)');
  let moduleFunction = vm.compileFunction(code, ['exports', 'require', 'module', '__dirname', '__filename', 'parcelRequire'], {
    filename,
  });

  let dirname = path.dirname(filename);
  let module = {
    exports: {},
    require,
    children: [],
    filename,
    id,
    path: dirname
  };

  moduleCache.set(id, module);
  moduleFunction(module.exports, require, module, dirname, filename, parcelRequire);
  return module.exports;
}

function getCacheKey(asset: Asset) {
  return asset.filePath + '#' + asset.env.context;
}

function getSpecifier(dep: Dependency) {
  if (typeof dep.meta.placeholder === 'string') {
    return dep.meta.placeholder;
  }

  return dep.specifier;
}
