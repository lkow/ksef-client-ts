declare module 'xml-crypto' {
  export class C14nCanonicalization {
    process(node: Node): string;
  }
  export class ExclusiveCanonicalization {
    process(node: Node): string;
  }
}
