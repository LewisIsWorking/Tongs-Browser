/**
 * Putting text on the clipboard from a button tap. Extracted from TongsBrowser 2026-08-11.
 *
 * Extracted because that file had reached 1,691 lines against a hard 200 line limit, and because
 * copying has nothing whatever to do with virtual pointers: it is a browser capability problem with
 * one interesting wrinkle, and it belongs somewhere it can be tested on its own.
 */

/**
 * Put text on the clipboard, returning whether a copy was attempted.
 *
 * ⚠️ `navigator.clipboard` is gated to SECURE CONTEXTS, and a self hosted Foundry on a LAN address is
 * plain http, so on a phone it is simply undefined. That is exactly the setup this exists for, which
 * makes the `execCommand` path the one that matters and the modern API the optimisation, not the
 * other way round. A copy button that silently does nothing on the target device would be worse than
 * no button at all.
 *
 * The document is passed in rather than reached for, so this can be tested against a document the
 * test controls, and so the fallback's temporary field lands in the same document as everything else.
 */
export function copyToClipboard(doc: Document, text: string): boolean {
  const clipboard = (
    doc.defaultView?.navigator as
      { clipboard?: { writeText?: (value: string) => Promise<void> } } | undefined
  )?.clipboard;

  if (clipboard?.writeText !== undefined) {
    // Fire and forget, with the insecure fallback wired to the rejection. The modern API resolves
    // asynchronously, so waiting for it would mean the button could not report anything useful.
    void clipboard.writeText(text).catch(() => {
      copyWithExecCommand(doc, text);
    });
    return true;
  }
  return copyWithExecCommand(doc, text);
}

/**
 * The insecure context fallback.
 *
 * Positioned off screen rather than hidden with `display: none`, because a field that is not rendered
 * cannot be selected and the copy then silently does nothing. The field is removed in a `finally`, so
 * a throw cannot leave a stray textarea in Foundry's DOM.
 */
export function copyWithExecCommand(doc: Document, text: string): boolean {
  const field = doc.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', 'true');
  field.style.position = 'fixed';
  field.style.top = '-1000px';
  field.style.opacity = '0';
  doc.body.append(field);

  try {
    field.select();
    field.setSelectionRange(0, text.length);
    // Deprecated, and the only thing that works outside a secure context.
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    return doc.execCommand('copy');
  } catch {
    return false;
  } finally {
    field.remove();
  }
}
