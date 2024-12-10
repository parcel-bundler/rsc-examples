import {Namer} from '@parcel/plugin';
import path from 'path';

export default new Namer({
  name({bundle, bundleGraph}) {
    let main = bundle.getMainEntry();
    if (bundle.type === 'js' && bundle.needsStableName && main) {
      let entryRoot = bundleGraph.getEntryRoot(bundle.target);
      let name = path.basename(main.filePath, path.extname(main.filePath)) + '.html';
      return path
        .join(path.relative(entryRoot, path.dirname(main.filePath)), name)
        .replace(/\.\.(\/|\\)/g, 'up_$1');
    }
  }
});
