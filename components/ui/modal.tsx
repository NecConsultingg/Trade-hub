'use client';
import React, { ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function Modal({ open, onClose, children }: ModalProps) {
  if (!open) return null;
   return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Capa de fondo que desenfoca */}
      <div
        className="absolute inset-0 backdrop-blur-md"
        onClick={onClose}
      />
      {/* Contenedor del modal */}
      <div
        className="relative bg-white rounded-2xl p-6 shadow-xl w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
