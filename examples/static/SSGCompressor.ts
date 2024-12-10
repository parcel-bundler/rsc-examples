import {Compressor} from "@parcel/plugin";
import {Transform} from 'stream';

// This is a hack to re-extract the flight data from the HTML stream into a separate RSC file for client navigations.
// TODO: handle binary chunks

let start = '<script>(self.__FLIGHT_DATA||=[]).push(';
let end = ')</script>';

export default new Compressor({
  compress({stream}) {
    let buffer = '';
    return {
      stream: stream.pipe(new Transform({
        transform(chunk, encoding, cb) {
          let c = chunk.toString('utf8');
          if (buffer.length) {
            let endIndex = c.indexOf(end);
            if (endIndex < 0) {
              buffer += c;
              return cb(null, '');
            } else {
              buffer += c.slice(0, endIndex);
            }
          }

          for (let index = c.indexOf(start); index >= 0 && index < c.length; index = c.indexOf(start, index + 1)) {
            let endIndex = c.indexOf(end, index);
            if (endIndex < 0) {
              buffer += c.slice(index + start.length);
              return cb(null, '');
            }
            buffer += c.slice(index + start.length, endIndex);
          }
          
          let data = JSON.parse(buffer);
          buffer = '';
          cb(null, data);
        },
        flush(cb) {
          cb(null);
        }
      })),
      type: 'rsc'
    };
  },
});
