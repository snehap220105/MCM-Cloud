export default function Toast({ html }) {
  return <div className="toast" dangerouslySetInnerHTML={{ __html: html }} />;
}
