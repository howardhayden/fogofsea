"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { containDialogTab } from "./dialogFocus";

type ConfirmDialogProps = {
  title: string;
  description: string;
  confirmLabel: string;
  children?: ReactNode;
  destructive?: boolean;
  opener?: HTMLElement | null;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmDialog({
  title,
  description,
  confirmLabel,
  children,
  destructive = false,
  opener = null,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const restoreOnCloseRef = useRef(true);

  useEffect(() => {
    openerRef.current = opener || (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const timer = window.setTimeout(() => cancelRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(timer);
      const opener = openerRef.current;
      if (restoreOnCloseRef.current && opener?.isConnected && opener.getClientRects().length > 0) window.setTimeout(() => opener.focus(), 0);
    };
  }, [opener]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
      return;
    }
    if (dialogRef.current) containDialogTab(event, dialogRef.current);
  };

  return (
    <div className="modal-backdrop confirm-backdrop" role="presentation">
      <section
        ref={dialogRef}
        className="confirm-dialog"
        role={destructive ? "alertdialog" : "dialog"}
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-description"
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <span>CHECK BEFORE CONTINUING</span>
        <h2 id="confirm-title">{title}</h2>
        <p id="confirm-description">{description}</p>
        {children}
        <div className="confirm-actions">
          <button ref={cancelRef} type="button" onClick={onCancel}>CANCEL</button>
          <button className={destructive ? "danger" : "confirm"} type="button" onClick={() => { restoreOnCloseRef.current = false; onConfirm(); }}>{confirmLabel}</button>
        </div>
      </section>
    </div>
  );
}
