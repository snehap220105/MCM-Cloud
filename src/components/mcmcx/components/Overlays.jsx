/** Toast queue, slide-in drawer, and confirm dialog — rendered once at app root. */
import { useUi } from '@/store/ui';
export function Toasts() {
  const { toasts } = useUi();
  if (toasts.length === 0) return null;
  return (
    <>
      {toasts.map((toast, index) => (
        <div
          key={toast.id}
          className="toast"
          style={{
            bottom: 20 + index * 44,
          }}
        >
          {toast.message}
        </div>
      ))}
    </>
  );
}
export function Drawer() {
  const { drawer, closeDrawer } = useUi();
  if (!drawer) return null;
  return (
    <>
      <div id="scrim" onClick={closeDrawer} />
      <div
        id="drw"
        style={
          drawer.width
            ? {
                width: drawer.width,
              }
            : undefined
        }
      >
        <div className="dh">
          <h2>{drawer.title}</h2>
          <div className="x" onClick={closeDrawer} role="button" aria-label="Close">
            ×
          </div>
        </div>
        <div className="db">{drawer.body}</div>
        {drawer.footer ? <div className="df">{drawer.footer}</div> : null}
      </div>
    </>
  );
}
export function ConfirmBox() {
  const { confirmRequest, resolveConfirm } = useUi();
  if (!confirmRequest) return null;
  return (
    <>
      <div
        id="scrim"
        style={{
          zIndex: 310,
        }}
        onClick={() => resolveConfirm(false)}
      />
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%,-50%)',
          background: '#fff',
          borderRadius: 8,
          padding: '22px 24px',
          width: 400,
          zIndex: 320,
          boxShadow: '0 20px 60px rgba(16,30,60,.3)',
        }}
      >
        <div
          style={{
            fontSize: 13.5,
            color: '#20303f',
            lineHeight: 1.6,
            marginBottom: 18,
          }}
        >
          {confirmRequest.message}
        </div>
        <div
          style={{
            display: 'flex',
            gap: 8,
            justifyContent: 'flex-end',
          }}
        >
          <button className="btn sec" onClick={() => resolveConfirm(false)}>
            Cancel
          </button>
          <button className="btn" onClick={() => resolveConfirm(true)}>
            Confirm
          </button>
        </div>
      </div>
    </>
  );
}
