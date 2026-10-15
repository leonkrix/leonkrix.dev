/**
 * The label of a button that changes ("Give up" and "Really give up?"). Both texts take the same
 * place: the one that is not shown is there, invisible, so the button is as high and as wide as
 * the longer text needs and does not change its size when the text changes. (Without it the longer
 * one wraps in a narrow column and the buttons below it move.)
 */
export default function SwapLabel({ shown, other }: { shown: string; other: string }) {
  return (
    <span className="wr-swap">
      <span>{shown}</span>
      <span aria-hidden="true">{other}</span>
    </span>
  );
}
