'use client'

import React, { useRef, useState } from 'react'
import type { ModelTagMapping } from '../../types'

// ─── Inlined formula symbols data ──────────────────────────────────────────────

interface FormulaSymbol {
  symbol: string
  description: string
  category: 'Iteration' | 'Complex' | 'PathDepth' | 'ConstantResolved' | 'Index'
}

const FORMULA_SYMBOLS: FormulaSymbol[] = [
  {
    symbol: 'submodel',
    description: 'Full sub-model name for the current topology node — model alias + node path (e.g. pdi_train1_d1). Use in Inferred expressions like model(<<submodel>>).',
    category: 'PathDepth',
  },
  {
    symbol: 'all',
    description: 'Iterate all children at target level',
    category: 'Iteration',
  },
  {
    symbol: 'spall_status',
    description: 'Generate spall status formula',
    category: 'Complex',
  },
  {
    symbol: 'fur',
    description: 'Furnace level path prefix',
    category: 'PathDepth',
  },
  {
    symbol: 'cell',
    description: 'Furnace → Cell path prefix',
    category: 'PathDepth',
  },
  {
    symbol: 'pass',
    description: 'Furnace → Cell → Pass path prefix',
    category: 'PathDepth',
  },
  {
    symbol: 'tube',
    description: 'Furnace → Cell → Pass → Tube path prefix',
    category: 'PathDepth',
  },
  {
    symbol: 'sg',
    description: 'Spall Group path prefix for the current pass — context-aware: looks up which SG contains this pass via spallConfig (e.g. h1_p1_p3)',
    category: 'PathDepth',
  },
  {
    symbol: 'train',
    description: 'Drum train level path prefix',
    category: 'PathDepth',
  },
  {
    symbol: 'drum',
    description: 'Drum train → Drum path prefix',
    category: 'PathDepth',
  },
  {
    symbol: 'frac',
    description: 'Fractionator level path prefix',
    category: 'PathDepth',
  },
  {
    symbol: 'colovhd',
    description: 'Fractionator → Column Overhead path prefix',
    category: 'PathDepth',
  },
  {
    symbol: 'colreb',
    description: 'Fractionator → Column Reboiler path prefix',
    category: 'PathDepth',
  },
  {
    symbol: 'attribute_level',
    description: 'Variable sensor level (e.g., replace with cop_level, cip_level, etc.)',
    category: 'ConstantResolved',
  },
  {
    symbol: 'N',
    description: 'Copy index for multiplied attributes (1, 2, … N). Substituted at expansion time — valid only in expressions of attributes registered in MULTIPLIED_ATTRIBUTES.',
    category: 'Index',
  },
  {
    symbol: 'N_max',
    description: 'Maximum copy index — equals hold_temp_steps. References the highest-index (highest hold temp) copy.',
    category: 'Index',
  },
  {
    symbol: 'N_mid',
    description: 'Middle copy index — Math.ceil(hold_temp_steps / 2). With 1 or 2 steps = 1; with 3 steps = 2.',
    category: 'Index',
  },
  {
    symbol: 'N_min',
    description: 'Minimum copy index — always 1. References the lowest-index (lowest hold temp) copy.',
    category: 'Index',
  },
]

// ─── Component interfaces ──────────────────────────────────────────────────────

interface Props {
  expression: string
  onExpressionChange: (expr: string) => void
  allMappings: ModelTagMapping[]
  isDisabled?: boolean
  hideHelpers?: boolean
  inputRef?: React.RefObject<HTMLInputElement | null>
}

export interface HelperPanelsProps {
  uniqueAttributes: string[]
  onInsertAttribute: (attr: string) => void
  onInsertSymbol: (symbol: string) => void
  isDisabled?: boolean
}

// ─── HelperPanels component ────────────────────────────────────────────────────

export function HelperPanels({ uniqueAttributes, onInsertAttribute, onInsertSymbol, isDisabled = false }: HelperPanelsProps) {
  const [attrSearchActive, setAttrSearchActive] = useState(false)
  const [attrSearchQuery, setAttrSearchQuery] = useState('')
  const [symSearchActive, setSymSearchActive] = useState(false)
  const [symSearchQuery, setSymSearchQuery] = useState('')
  const attrSearchInputRef = useRef<HTMLInputElement>(null)
  const symSearchInputRef = useRef<HTMLInputElement>(null)
  const attributesPanelRef = useRef<HTMLDivElement>(null)
  const symbolsPanelRef = useRef<HTMLDivElement>(null)

  const filteredAttributes = uniqueAttributes.filter(attr =>
    attr.toLowerCase().includes(attrSearchQuery.toLowerCase())
  )

  const filteredSymbols = FORMULA_SYMBOLS.filter(sym =>
    sym.symbol.toLowerCase().includes(symSearchQuery.toLowerCase())
  )

  React.useEffect(() => {
    if (attrSearchActive && attrSearchInputRef.current) {
      attrSearchInputRef.current.focus()
    }
  }, [attrSearchActive])

  React.useEffect(() => {
    if (symSearchActive && symSearchInputRef.current) {
      symSearchInputRef.current.focus()
    }
  }, [symSearchActive])

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (attributesPanelRef.current && !attributesPanelRef.current.contains(event.target as Node)) {
        setAttrSearchActive(false)
        setAttrSearchQuery('')
      }
      if (symbolsPanelRef.current && !symbolsPanelRef.current.contains(event.target as Node)) {
        setSymSearchActive(false)
        setSymSearchQuery('')
      }
    }

    if (attrSearchActive || symSearchActive) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [attrSearchActive, symSearchActive])

  return (
    <div className="flex gap-1.5 h-full">
      {/* Attributes Panel */}
      <div
        ref={attributesPanelRef}
        className={`flex-1 flex flex-col border border-border rounded overflow-hidden ${isDisabled ? 'opacity-60' : ''}`}
        style={{ background: isDisabled ? undefined : undefined }}
      >
        <div className="px-2 py-1.5 text-[9px] font-bold text-white bg-[#1e3a5f] border-b border-border uppercase tracking-[0.5px] flex items-center justify-between gap-1">
          {attrSearchActive ? (
            <input
              ref={attrSearchInputRef}
              type="text"
              placeholder="Search..."
              value={attrSearchQuery}
              onChange={(e) => setAttrSearchQuery(e.target.value)}
              className="flex-1 px-1 py-0.5 text-[9px] border-none rounded-sm bg-white text-text-primary font-[inherit] box-border focus:outline-none"
            />
          ) : (
            <span>Attributes</span>
          )}
          <button
            onClick={() => {
              setAttrSearchActive(!attrSearchActive)
              if (attrSearchActive) setAttrSearchQuery('')
            }}
            disabled={isDisabled}
            className={`bg-transparent border-none text-white text-xs p-0 flex items-center ${isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
            title="Search attributes"
          >
            🔍
          </button>
        </div>
        <div className="flex-1 overflow-y-auto pt-1 bg-surface">
          {filteredAttributes.length === 0 ? (
            <div className="p-2 text-[10px] text-text-secondary text-center">
              {attrSearchQuery ? 'No matches' : 'No attributes'}
            </div>
          ) : (
            filteredAttributes.map(attr => (
              <button
                key={attr}
                onClick={() => onInsertAttribute(attr)}
                disabled={isDisabled}
                className={`w-full px-2 py-1.5 text-[10px] border-none border-b border-border bg-transparent text-text-primary text-left font-mono transition-colors ${
                  isDisabled ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-surface-hover'
                }`}
              >
                {attr}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Symbols Panel */}
      <div
        ref={symbolsPanelRef}
        className={`flex-1 flex flex-col border border-border rounded overflow-hidden ${isDisabled ? 'opacity-60' : ''}`}
      >
        <div className="px-2 py-1.5 text-[9px] font-bold text-white bg-accent-green border-b border-border uppercase tracking-[0.5px] flex items-center justify-between gap-1">
          {symSearchActive ? (
            <input
              ref={symSearchInputRef}
              type="text"
              placeholder="Search..."
              value={symSearchQuery}
              onChange={(e) => setSymSearchQuery(e.target.value)}
              className="flex-1 px-1 py-0.5 text-[9px] border-none rounded-sm bg-white text-text-primary font-[inherit] box-border focus:outline-none"
            />
          ) : (
            <span>Symbols</span>
          )}
          <button
            onClick={() => {
              setSymSearchActive(!symSearchActive)
              if (symSearchActive) setSymSearchQuery('')
            }}
            disabled={isDisabled}
            className={`bg-transparent border-none text-white text-xs p-0 flex items-center ${isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
            title="Search symbols"
          >
            🔍
          </button>
        </div>
        <div className="flex-1 overflow-y-auto pt-1 bg-surface">
          {filteredSymbols.length === 0 ? (
            <div className="p-2 text-[10px] text-text-secondary text-center">
              {symSearchQuery ? 'No matches' : 'No symbols'}
            </div>
          ) : (
            filteredSymbols.map(sym => (
              <button
                key={sym.symbol}
                onClick={() => onInsertSymbol(sym.symbol)}
                disabled={isDisabled}
                title={sym.description}
                className={`w-full px-2 py-1.5 text-[10px] border-none border-b border-border bg-transparent text-text-primary text-left font-mono transition-colors whitespace-nowrap overflow-hidden text-ellipsis ${
                  isDisabled ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-surface-hover'
                }`}
              >
                &lt;&lt;{sym.symbol}&gt;&gt;
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// ─── ExpressionBuilder default export ─────────────────────────────────────────

export default function ExpressionBuilder({ expression, onExpressionChange, allMappings, isDisabled = false, hideHelpers = false, inputRef: externalRef }: Props) {
  const internalRef = useRef<HTMLInputElement>(null)
  const inputRef = externalRef || internalRef
  // Saved cursor position — updated on every selection change and on blur,
  // so clicking a helper button (which blurs the input) still inserts at the right place.
  const cursorPos = useRef({ start: 0, end: 0 })

  // Get unique attributes from all mappings
  const uniqueAttributes = Array.from(new Set(allMappings.map(m => m.attribute))).sort()

  const saveCursorPos = () => {
    const input = inputRef.current
    if (!input) return
    cursorPos.current = {
      start: input.selectionStart ?? expression.length,
      end:   input.selectionEnd   ?? expression.length,
    }
  }

  const insertAtCursor = (text: string) => {
    if (!inputRef.current) return

    const input = inputRef.current
    const { start, end } = cursorPos.current

    const newValue = expression.substring(0, start) + text + expression.substring(end)
    onExpressionChange(newValue)

    const newCursor = start + text.length
    cursorPos.current = { start: newCursor, end: newCursor }

    // Restore focus and cursor position after React re-renders the controlled input
    setTimeout(() => {
      input.focus()
      input.setSelectionRange(newCursor, newCursor)
    }, 0)
  }

  const insertAttribute = (attr: string) => {
    const input = inputRef.current
    if (!input) return

    const start = input.selectionStart || 0
    const textBefore = expression.substring(0, start)

    // Check if we're right after a symbol (e.g., "<<pass>>")
    const symbolMatch = textBefore.match(/<<\w+>>_?$/)

    if (symbolMatch) {
      // We're after a symbol, so just add attribute name with underscore
      const needsUnderscore = !textBefore.endsWith('_')
      const prefix = needsUnderscore ? '_' : ''
      insertAtCursor(`${prefix}${attr}`)
    } else {
      // Normal case: wrap in braces
      insertAtCursor(`{${attr}}`)
    }
  }

  const insertSymbol = (symbol: string) => {
    insertAtCursor(`<<${symbol}>>_`)
  }

  // Auto-correct expression: remove nested braces after symbols
  const autoCorrectExpression = (expr: string): string => {
    // Fix pattern: {<<symbol>>_{attr}} → {<<symbol>>_attr}
    return expr.replace(/\{(<<\w+>>)_\{([^}]+)\}\}/g, '{$1_$2}')
  }

  const handleExpressionChange = (newExpr: string) => {
    const corrected = autoCorrectExpression(newExpr)
    onExpressionChange(corrected)
  }

  return (
    <div className="flex gap-3 mb-3">
      {/* Expression Input */}
      <div className={hideHelpers ? undefined : 'flex-1'}>
        <label className="block text-[10px] font-semibold text-text-secondary mb-1">Expression</label>
        <input
          ref={inputRef}
          type="text"
          value={expression}
          onChange={(e) => handleExpressionChange(e.target.value)}
          onSelect={saveCursorPos}
          onKeyUp={saveCursorPos}
          onMouseUp={saveCursorPos}
          onBlur={saveCursorPos}
          disabled={isDisabled}
          placeholder="e.g. {<<pass>>_max_tmt}-{<<pass>>_cot}"
          className={`w-full px-2 py-1.5 text-[11px] border border-border rounded bg-surface text-text-primary font-mono box-border focus:outline-none focus:ring-1 focus:ring-accent-blue ${
            isDisabled ? 'opacity-60 cursor-not-allowed bg-surface-hover' : 'cursor-text'
          }`}
        />
      </div>

      {/* Helper Panels */}
      {!hideHelpers && (
        <HelperPanels
          uniqueAttributes={uniqueAttributes}
          onInsertAttribute={insertAttribute}
          onInsertSymbol={insertSymbol}
          isDisabled={isDisabled}
        />
      )}
    </div>
  )
}
