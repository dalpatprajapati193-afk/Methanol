'use client'

import React from 'react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  maxWidth?: number
}

export default function Modal({ isOpen, onClose, title, children, maxWidth = 640 }: ModalProps) {
  if (!isOpen) return null
  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[1000] p-5"
      style={{ background: 'rgba(0,0,0,0.4)' }}
    >
      <div
        className="bg-surface rounded-xl w-full overflow-hidden flex flex-col shadow-2xl"
        style={{ maxWidth, maxHeight: '90vh' }}
      >
        {/* Header */}
        <div className="px-6 pt-5 pb-4 flex items-center justify-between border-b border-border shrink-0">
          <span className="text-base font-semibold text-text-primary">{title}</span>
          <button
            onClick={onClose}
            className="bg-transparent border-none text-text-secondary cursor-pointer text-xl leading-none px-1.5 py-0.5 rounded hover:text-text-primary transition-colors"
          >
            ×
          </button>
        </div>
        {/* Body */}
        <div className="px-6 pt-5 pb-6 overflow-y-auto flex-1">
          {children}
        </div>
      </div>
    </div>
  )
}
