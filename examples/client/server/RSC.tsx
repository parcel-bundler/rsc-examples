"use server-entry";

import {Counter} from './Counter';
import {Resources} from '@parcel/runtime-rsc';
import './RSC.css';

export async function RSC() {
  return (
    <div className="rsc">
      <Resources />
      <h2>RSC!</h2>
      <Counter />
    </div>
  );
}
