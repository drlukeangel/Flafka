/**
 * @schema-tree-view @schema-panel
 * SchemaTreeView - Recursive Avro schema field tree renderer.
 * Supports expand/collapse per node, type badges, defaults display.
 */

import { useState, useCallback, useMemo } from 'react';
import { FiChevronRight, FiChevronDown, FiCopy } from 'react-icons/fi';

interface AvroField {
  name: string;
  type: unknown;
  default?: unknown;
  doc?: string;
  [key: string]: unknown;
}

interface AvroSchema {
  type?: string;
  fields?: AvroField[];
  name?: string;
  namespace?: string;
  [key: string]: unknown;
}

interface SchemaTreeViewProps {
  schema: string;
}

// ---------------------------------------------------------------------------
// Type resolution helpers
// ---------------------------------------------------------------------------

function resolveTypeName(type: unknown): string {
  if (typeof type === 'string') return type;
  if (Array.isArray(type)) {
    // Union type — filter out null and show remaining types
    const nonNull = (type as unknown[]).filter((t) => t !== 'null');
    if (nonNull.length === 1) return resolveTypeName(nonNull[0]);
    return (type as unknown[]).map((t) => resolveTypeName(t)).join(' | ');
  }
  if (type && typeof type === 'object') {
    const obj = type as Record<string, unknown>;
    if (obj.type === 'record') return `record<${obj.name as string}>`;
    if (obj.type === 'array') return `array<${resolveTypeName(obj.items)}>`;
    if (obj.type === 'map') return `map<string, ${resolveTypeName(obj.values)}>`;
    if (obj.type === 'enum') return `enum<${obj.name as string}>`;
    if (obj.type === 'fixed') return `fixed<${obj.name as string}>`;
    if (typeof obj.type === 'string') return obj.type;
  }
  return 'unknown';
}

function getNestedFields(type: unknown): AvroField[] | null {
  if (!type || typeof type !== 'object') return null;
  if (Array.isArray(type)) {
    for (const t of type as unknown[]) {
      const nested = getNestedFields(t);
      if (nested) return nested;
    }
    return null;
  }
  const obj = type as Record<string, unknown>;
  if (obj.type === 'record' && Array.isArray(obj.fields)) {
    return obj.fields as AvroField[];
  }
  if (obj.type === 'array') {
    return getNestedFields(obj.items);
  }
  return null;
}

function isNullable(type: unknown): boolean {
  return Array.isArray(type) && (type as unknown[]).includes('null');
}

// ---------------------------------------------------------------------------
// Type badge color mapping (all via CSS vars — inline style approach)
// ---------------------------------------------------------------------------

type BadgeStyle = { background: string; color: string };

function getTypeBadgeStyle(typeName: string): BadgeStyle {
  const base = typeName.split('<')[0].split(' | ').find((t) => t !== 'null') ?? typeName;
  switch (base.toLowerCase()) {
    case 'string':
      return { background: 'rgba(34,197,94,0.15)', color: 'var(--color-success)' };
    case 'int':
    case 'long':
    case 'float':
    case 'double':
    case 'bytes':
      return { background: 'rgba(59,130,246,0.15)', color: 'var(--color-info)' };
    case 'boolean':
      return { background: 'rgba(245,158,11,0.15)', color: 'var(--color-warning)' };
    case 'record':
      // @phase-12.5-schema-colors: dedicated --color-schema-record var (light: #8B5CF6, dark: #A78BFA)
      return { background: 'var(--color-schema-record-bg)', color: 'var(--color-schema-record)' };
    case 'array':
      // @phase-12.5-schema-colors: --color-schema-array + --color-schema-array-bg
      return { background: 'var(--color-schema-array-bg)', color: 'var(--color-schema-array)' };
    case 'map':
      // @phase-12.5-schema-colors: --color-schema-map (alias of array teal, separate semantic var)
      return { background: 'var(--color-schema-array-bg)', color: 'var(--color-schema-map)' };
    case 'enum':
      return { background: 'rgba(245,158,11,0.15)', color: 'var(--color-warning)' };
    case 'null':
      return { background: 'rgba(156,163,175,0.15)', color: 'var(--color-text-tertiary)' };
    default:
      return { background: 'rgba(156,163,175,0.15)', color: 'var(--color-text-secondary)' };
  }
}

// ---------------------------------------------------------------------------
// FieldNode — single field row with optional recursive children
// ---------------------------------------------------------------------------

interface FieldNodeProps {
  field: AvroField;
  depth: number;
  expandAll: boolean | null; // null = user-controlled, true/false = forced
  expandedByDefault: boolean;
}

function FieldNode({ field, depth, expandAll, expandedByDefault }: FieldNodeProps) {
  const [expanded, setExpanded] = useState(expandedByDefault);
  // Item 2: copy-to-clipboard state for field name
  const [copiedField, setCopiedField] = useState(false);

  const nestedFields = useMemo(() => getNestedFields(field.type), [field.type]);
  const typeName = useMemo(() => resolveTypeName(field.type), [field.type]);
  const nullable = useMemo(() => isNullable(field.type), [field.type]);
  const badgeStyle = useMemo(() => getTypeBadgeStyle(typeName), [typeName]);
  const hasChildren = nestedFields !== null && nestedFields.length > 0;

  const isExpanded = expandAll !== null ? expandAll : expanded;

  const handleToggle = useCallback(() => {
    if (expandAll !== null) return; // controlled by parent
    setExpanded((prev) => !prev);
  }, [expandAll]);

  // Item 2: click-to-copy field name
  const handleCopyFieldName = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation(); // don't toggle expand
    try {
      await navigator.clipboard.writeText(field.name);
      setCopiedField(true);
      setTimeout(() => setCopiedField(false), 1500);
    } catch {
      // silently fail
    }
  }, [field.name]);

  const indent = depth * 16;
  const hasDefault = field.default !== undefined;
  // Item 5: fix null default display — show as styled "null" rather than empty or raw string
  const defaultDisplay = hasDefault
    ? field.default === null
      ? 'null'
      : typeof field.default === 'object'
      ? JSON.stringify(field.default)
      : String(field.default)
    : null;

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          paddingLeft: indent + 8,
          paddingRight: 8,
          paddingTop: 5,
          paddingBottom: 5,
          cursor: hasChildren ? 'pointer' : 'default',
          borderRadius: 4,
          transition: `background var(--transition-fast)`,
        }}
        onClick={hasChildren ? handleToggle : undefined}
        role={hasChildren ? 'button' : undefined}
        tabIndex={hasChildren ? 0 : undefined}
        aria-expanded={hasChildren ? isExpanded : undefined}
        onKeyDown={hasChildren ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleToggle(); } } : undefined}
        className="schema-tree-row"
      >
        {/* Expand arrow */}
        <span
          style={{
            width: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-text-tertiary)',
            flexShrink: 0,
          }}
        >
          {hasChildren
            ? (isExpanded ? <FiChevronDown size={12} /> : <FiChevronRight size={12} />)
            : null}
        </span>

        {/* Field name — Item 2: click copy icon to copy field name */}
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontFamily: "'SF Mono', Monaco, Consolas, monospace",
              fontSize: 12,
              color: 'var(--color-text-primary)',
              fontWeight: 500,
            }}
            title={field.doc ?? field.name}
          >
            {field.name}
          </span>
          <button
            onClick={handleCopyFieldName}
            title={`Copy field name: ${field.name}`}
            aria-label={`Copy field name ${field.name}`}
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              padding: 2,
              display: 'flex',
              alignItems: 'center',
              color: copiedField ? 'var(--color-success)' : 'var(--color-text-tertiary)',
              borderRadius: 3,
              opacity: 0,
              transition: 'opacity var(--transition-fast), color var(--transition-fast)',
            }}
            className="field-copy-btn"
          >
            <FiCopy size={10} aria-hidden="true" />
          </button>
        </span>

        {/* Nullable indicator */}
        {nullable && (
          <span
            style={{
              fontSize: 10,
              color: 'var(--color-text-tertiary)',
              flexShrink: 0,
            }}
            title="Nullable"
          >
            ?
          </span>
        )}

        {/* Type badge */}
        <span
          style={{
            ...badgeStyle,
            padding: '1px 6px',
            borderRadius: 3,
            fontSize: 11,
            fontWeight: 600,
            fontFamily: "'SF Mono', Monaco, Consolas, monospace",
            flexShrink: 0,
          }}
          title={`Type: ${typeName}`}
        >
          {typeName.length > 24 ? `${typeName.slice(0, 22)}…` : typeName}
        </span>

        {/* Default value — Item 5: null is shown as styled keyword */}
        {defaultDisplay !== null && (
          <span
            style={{
              fontSize: 11,
              color: field.default === null ? 'var(--color-text-tertiary)' : 'var(--color-text-tertiary)',
              marginLeft: 4,
              fontFamily: "'SF Mono', Monaco, Consolas, monospace",
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: 120,
            }}
            title={`Default: ${defaultDisplay}`}
          >
            ={' '}
            {field.default === null ? (
              <em style={{ fontStyle: 'normal', color: 'var(--color-text-tertiary)', opacity: 0.7 }}>
                null
              </em>
            ) : defaultDisplay.length > 16 ? `${defaultDisplay.slice(0, 14)}…` : defaultDisplay}
          </span>
        )}
      </div>

      {/* Nested fields */}
      {hasChildren && isExpanded && (
        <div>
          {nestedFields!.map((child, idx) => (
            <FieldNode
              key={`${child.name}-${idx}`}
              field={child}
              depth={depth + 1}
              expandAll={expandAll}
              expandedByDefault={false}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SchemaTreeView — main exported component
// ---------------------------------------------------------------------------

export default function SchemaTreeView({ schema }: SchemaTreeViewProps) {
  const [expandAll, setExpandAll] = useState<boolean | null>(null);

  const parsed = useMemo<AvroSchema | null>(() => {
    try {
      const obj = JSON.parse(schema) as AvroSchema;
      return obj;
    } catch {
      return null;
    }
  }, [schema]);

  const fields = useMemo<AvroField[] | null>(() => {
    if (!parsed) return null;
    if (Array.isArray(parsed.fields)) return parsed.fields as AvroField[];
    return null;
  }, [parsed]);

  if (!parsed) {
    return (
      <div
        style={{
          padding: '12px 16px',
          color: 'var(--color-text-secondary)',
          fontSize: 12,
          fontStyle: 'italic',
        }}
      >
        Unable to parse schema JSON.
      </div>
    );
  }

  if (!fields) {
    return (
      <div
        style={{
          padding: '12px 16px',
          color: 'var(--color-text-secondary)',
          fontSize: 12,
          fontStyle: 'italic',
        }}
      >
        Schema tree view is only available for Avro schemas with a{' '}
        <code
          style={{
            fontFamily: "'SF Mono', Monaco, Consolas, monospace",
            background: 'var(--color-surface-secondary)',
            padding: '1px 4px',
            borderRadius: 3,
          }}
        >
          fields
        </code>{' '}
        array.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 8px',
          borderBottom: '1px solid var(--color-border)',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: 11,
            color: 'var(--color-text-tertiary)',
            marginRight: 'auto',
          }}
        >
          {fields.length} field{fields.length !== 1 ? 's' : ''}
          {parsed.name ? ` · ${parsed.name}` : ''}
          {parsed.namespace ? ` · ${parsed.namespace}` : ''}
        </span>
        <button
          style={{
            padding: '3px 8px',
            borderRadius: 4,
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface)',
            color: 'var(--color-text-secondary)',
            fontSize: 11,
            cursor: 'pointer',
          }}
          onClick={() => setExpandAll(true)}
          title="Expand all fields"
        >
          Expand All
        </button>
        <button
          style={{
            padding: '3px 8px',
            borderRadius: 4,
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface)',
            color: 'var(--color-text-secondary)',
            fontSize: 11,
            cursor: 'pointer',
          }}
          onClick={() => setExpandAll(false)}
          title="Collapse all fields"
        >
          Collapse All
        </button>
        {expandAll !== null && (
          <button
            style={{
              padding: '3px 8px',
              borderRadius: 4,
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
              color: 'var(--color-text-secondary)',
              fontSize: 11,
              cursor: 'pointer',
            }}
            onClick={() => setExpandAll(null)}
            title="Reset to default expand state"
          >
            Reset
          </button>
        )}
      </div>

      {/* Field list */}
      <div
        style={{
          overflowY: 'auto',
          flex: 1,
          padding: '4px 0',
        }}
      >
        {fields.map((field, idx) => (
          <FieldNode
            key={`${field.name}-${idx}`}
            field={field}
            depth={0}
            expandAll={expandAll}
            expandedByDefault={true}
          />
        ))}
      </div>
    </div>
  );
}
