import { defineMiddleware } from 'astro:middleware';
import { parse, walk, walkSync, renderSync, ELEMENT_NODE } from 'ultrahtml';

export const onRequest = defineMiddleware(async (ctx, next) => {
  const response = await next();
  const html = await response.text();
  const ast = parse(html);
  const styleSrcs = [];

  await walk(ast, async (node) => {
    const inlineStyle = node?.attributes?.style;
    if (inlineStyle) {
      const encodedStyle = new TextEncoder().encode(inlineStyle);
      const digest = await crypto.subtle.digest('SHA-256', encodedStyle);
      styleSrcs.push('sha256-' + toBase64(digest));
    }
  });

  const headerValue = `style-src-attr 'unsafe-hashes' ${styleSrcs
    .map((src) => `'${src}'`)
    .join(' ')}`;

  walkSync(ast, async (node) => {
    if (node.type === ELEMENT_NODE && node.name === 'head') {
      node.children.push({
        type: ELEMENT_NODE,
        name: 'meta',
        attributes: {
          'http-equiv': 'Content-Security-Policy',
          content: headerValue,
        },
        children: [],
        parent: node,
        loc: undefined as any,
        isSelfClosingTag: true,
      });
    }
  });

  return new Response(renderSync(ast));
});

function toBase64(arrayBuffer: ArrayBuffer) {
  const byteArray = new Uint8Array(arrayBuffer);
  let byteString = '';
  for (let i = 0, { length } = byteArray; i < length; i++) {
    byteString += String.fromCharCode(byteArray[i]);
  }
  return btoa(byteString);
}
