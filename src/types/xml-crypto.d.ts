declare module 'xml-crypto' {
  export class C14nCanonicalization {
    process(node: import('@xmldom/xmldom').Node): string;
  }
  export class ExclusiveCanonicalization {
    process(node: import('@xmldom/xmldom').Node): string;
  }
}
