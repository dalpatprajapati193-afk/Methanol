import * as ReactNamespace from 'react';

declare global {
  namespace React {
    type ReactNode = ReactNamespace.ReactNode;
    type ComponentType<P = {}> = ReactNamespace.ComponentType<P>;
  }
}
export {};
