import { useEffect, useMemo, useRef, useState } from 'react';
import type { EmailTable, EmailTableCell } from '../types/email';

type Point = { row: number; column: number };
type Grid = (EmailTableCell | undefined)[][];

const makeCell = (content = ''): EmailTableCell => ({ id: crypto.randomUUID(), content, colSpan: 1, rowSpan: 1 });
const normalize = (table: EmailTable): EmailTable => ({ ...table, rows: table.rows?.length ? table.rows.map((row) => row.map((cell) => typeof cell === 'string' ? makeCell(cell) : { ...cell, id: cell.id || crypto.randomUUID(), colSpan: cell.colSpan || 1, rowSpan: cell.rowSpan || 1 })) : [[makeCell()]] });

function toGrid(table: EmailTable): Grid {
  const grid: Grid = [];
  table.rows.forEach((row, rowIndex) => {
    let column = 0;
    row.forEach((cell) => {
      const current = typeof cell === 'string' ? makeCell(cell) : cell;
      while (grid[rowIndex]?.[column]) column += 1;
      for (let y = 0; y < (current.rowSpan || 1); y += 1) {
        grid[rowIndex + y] ||= [];
        for (let x = 0; x < (current.colSpan || 1); x += 1) grid[rowIndex + y][column + x] = current;
      }
      column += current.colSpan || 1;
    });
  });
  const width = Math.max(1, ...grid.map((row) => row.length));
  return grid.map((row) => Array.from({ length: width }, (_, index) => row[index]));
}

function fromGrid(grid: Grid): EmailTableCell[][] {
  const seen = new Set<string>();
  return grid.map((row, rowIndex) => {
    const result: EmailTableCell[] = [];
    for (let column = 0; column < (grid[0]?.length || 1); column += 1) {
      const cell = row[column];
      if (!cell || seen.has(cell.id) || grid[rowIndex - 1]?.[column]?.id === cell.id || row[column - 1]?.id === cell.id) continue;
      let colSpan = 1;
      let rowSpan = 1;
      while (row[column + colSpan]?.id === cell.id) colSpan += 1;
      while (grid[rowIndex + rowSpan]?.[column]?.id === cell.id) rowSpan += 1;
      seen.add(cell.id);
      result.push({ ...cell, colSpan, rowSpan });
    }
    return result;
  });
}

function range(start: Point, end: Point): Point[] {
  const result: Point[] = [];
  for (let row = Math.min(start.row, end.row); row <= Math.max(start.row, end.row); row += 1) {
    for (let column = Math.min(start.column, end.column); column <= Math.max(start.column, end.column); column += 1) result.push({ row, column });
  }
  return result;
}

export default function SpreadsheetTableEditor({ value, update }: { value: EmailTable; update: (value: EmailTable) => void }) {
  const table = useMemo(() => normalize(value), [value]);
  const grid = useMemo(() => toGrid(table), [table]);
  const [anchor, setAnchor] = useState<Point | null>(null);
  const [focus, setFocus] = useState<Point | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; point: Point } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [history, setHistory] = useState<EmailTable[]>([]);
  const [future, setFuture] = useState<EmailTable[]>([]);
  const [dragging, setDragging] = useState(false);
  const [widths, setWidths] = useState(table.columnWidths || []);
  const [heights, setHeights] = useState(table.rowHeights || []);
  const tableRef = useRef<HTMLTableElement>(null);
  const rows = grid.length;
  const columns = grid[0]?.length || 1;
  const active = focus || { row: 0, column: 0 };
  const points = anchor && focus ? range(anchor, focus) : focus ? [focus] : [];
  const selectedIds = new Set(points.map((point) => grid[point.row]?.[point.column]?.id).filter(Boolean));
  const selectedCells = [...selectedIds].map((id) => grid.flat().find((cell) => cell?.id === id)).filter(Boolean) as EmailTableCell[];
  const cellAt = (point: Point) => grid[point.row]?.[point.column];

  useEffect(() => {
    const stop = () => { setDragging(false); setMenu(null); };
    window.addEventListener('mouseup', stop);
    return () => window.removeEventListener('mouseup', stop);
  }, []);
  useEffect(() => {
    const handleInputKey = (event: KeyboardEvent) => {
      if (!(event.target instanceof HTMLInputElement) || !event.target.closest('.spreadsheet-editor')) return;
      if (editing) { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.stopPropagation(); commitEdit(); } return; }
      const modified = event.ctrlKey || event.metaKey;
      if (modified && event.key.toLowerCase() === 'z') { event.preventDefault(); event.stopPropagation(); event.shiftKey ? redo() : undo(); return; }
      if (modified && event.key.toLowerCase() === 'c') { event.preventDefault(); event.stopPropagation(); copy(); return; }
      if (modified && event.key.toLowerCase() === 'v') { event.preventDefault(); event.stopPropagation(); void paste(); return; }
      if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); event.stopPropagation(); clear(); return; }
      const next = { ...active };
      if (event.key === 'ArrowUp') next.row -= 1;
      if (event.key === 'ArrowDown') next.row += 1;
      if (event.key === 'ArrowLeft' || (event.key === 'Tab' && event.shiftKey)) next.column -= 1;
      if (event.key === 'ArrowRight' || (event.key === 'Tab' && !event.shiftKey)) next.column += 1;
      if (next.row >= 0 && next.row < rows && next.column >= 0 && next.column < columns) { event.preventDefault(); event.stopPropagation(); setAnchor(event.shiftKey ? anchor : next); setFocus(next); }
    };
    window.addEventListener('keydown', handleInputKey, true);
    return () => window.removeEventListener('keydown', handleInputKey, true);
  });

  const commit = (next: EmailTable, record = true) => {
    if (record) { setHistory((current) => [...current.slice(-49), table]); setFuture([]); }
    update(next);
  };
  const commitGrid = (next: Grid) => commit({ ...table, rows: fromGrid(next) });
  const select = (point: Point, event: React.MouseEvent) => {
    if (event.button === 2) return;
    if ((event.shiftKey || event.ctrlKey || event.metaKey) && anchor) setFocus(point);
    else { setAnchor(point); setFocus(point); setDragging(true); }
    setMenu(null);
  };
  const edit = (point: Point) => { const cell = cellAt(point); if (!cell) return; setAnchor(point); setFocus(point); setEditing(cell.id); setEditValue(cell.content); setMenu(null); };
  const commitEdit = () => { if (!editing) return; commitGrid(grid.map((row) => row.map((cell) => cell?.id === editing ? { ...cell, content: editValue } : cell))); setEditing(null); };
  const apply = (patch: Partial<EmailTableCell>) => commitGrid(grid.map((row, rowIndex) => row.map((cell, columnIndex) => points.some((point) => point.row === rowIndex && point.column === columnIndex) && cell ? { ...cell, ...patch } : cell)));
  const targetPoint = menu?.point || active;
  const targetPoints = menu ? [targetPoint] : points;
  const clear = () => commitGrid(grid.map((row, rowIndex) => row.map((cell, columnIndex) => targetPoints.some((point) => point.row === rowIndex && point.column === columnIndex) && cell ? { ...cell, content: '' } : cell)));
  const addRow = (offset: 0 | 1) => { const next = grid.map((row) => [...row]); next.splice(targetPoint.row + offset, 0, Array.from({ length: columns }, () => makeCell())); commitGrid(next); };
  const deleteRow = () => rows > 1 && commitGrid(grid.filter((_, row) => row !== targetPoint.row));
  const moveRow = (direction: -1 | 1) => { const other = targetPoint.row + direction; if (other < 0 || other >= rows) return; const next = grid.map((row) => [...row]); [next[targetPoint.row], next[other]] = [next[other], next[targetPoint.row]]; commitGrid(next); };
  const addColumn = (offset: 0 | 1) => { const next = grid.map((row) => [...row]); next.forEach((row) => row.splice(targetPoint.column + offset, 0, makeCell())); commitGrid(next); };
  const deleteColumn = () => columns > 1 && commitGrid(grid.map((row) => row.filter((_, column) => column !== targetPoint.column)));
  const moveColumn = (direction: -1 | 1) => { const other = targetPoint.column + direction; if (other < 0 || other >= columns) return; const next = grid.map((row) => [...row]); next.forEach((row) => [row[targetPoint.column], row[other]] = [row[other], row[targetPoint.column]]); commitGrid(next); };
  const merge = () => {
    if (points.length < 2) return;
    const horizontal = points.every((point) => point.row === points[0].row);
    const vertical = points.every((point) => point.column === points[0].column);
    if (!horizontal && !vertical || points.some((point) => !cellAt(point) || (cellAt(point)?.colSpan || 1) > 1 || (cellAt(point)?.rowSpan || 1) > 1)) return;
    const first = cellAt(points[0]); if (!first) return;
    const ids = new Set(points.map((point) => cellAt(point)?.id));
    const merged = { ...first, id: crypto.randomUUID(), content: selectedCells.map((cell) => cell.content).filter(Boolean).join('<br>'), colSpan: horizontal ? points.length : 1, rowSpan: vertical ? points.length : 1 };
    commitGrid(grid.map((row) => row.map((cell) => cell && ids.has(cell.id) ? merged : cell)));
    setAnchor(null); setFocus(null);
  };
  const unmerge = () => { const cell = cellAt(active); if (!cell || ((cell.colSpan || 1) === 1 && (cell.rowSpan || 1) === 1)) return; commitGrid(grid.map((row) => row.map((current) => current?.id === cell.id ? { ...current, id: crypto.randomUUID(), colSpan: 1, rowSpan: 1 } : current))); };
  const copy = () => void navigator.clipboard.writeText(selectedCells.map((cell) => cell.content).join('\t'));
  const paste = async () => { const raw = await navigator.clipboard.readText().catch(() => ''); if (!raw) return; const values = raw.split(/\r?\n/).map((row) => row.split('\t')); const next = grid.map((row) => [...row]); values.forEach((row, y) => row.forEach((content, x) => { const cell = next[active.row + y]?.[active.column + x]; if (cell) next[active.row + y][active.column + x] = { ...cell, content }; })); commitGrid(next); };
  const undo = () => { const previous = history.at(-1); if (!previous) return; setHistory((current) => current.slice(0, -1)); setFuture((current) => [table, ...current]); update(previous); };
  const redo = () => { const next = future[0]; if (!next) return; setFuture((current) => current.slice(1)); setHistory((current) => [...current, table]); update(next); };
  const keyDown = (event: React.KeyboardEvent) => {
    if (editing) { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); commitEdit(); } return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') { event.preventDefault(); copy(); return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v') { event.preventDefault(); void paste(); return; }
    if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); clear(); return; }
    if (event.key === 'Enter') { event.preventDefault(); edit(active); return; }
    const next = { ...active };
    if (event.key === 'ArrowUp') next.row -= 1;
    if (event.key === 'ArrowDown') next.row += 1;
    if (event.key === 'ArrowLeft' || (event.key === 'Tab' && event.shiftKey)) next.column -= 1;
    if (event.key === 'ArrowRight' || (event.key === 'Tab' && !event.shiftKey)) next.column += 1;
    if (next.row >= 0 && next.row < rows && next.column >= 0 && next.column < columns) { event.preventDefault(); setAnchor(event.shiftKey ? anchor : next); setFocus(next); }
  };
  const resizeColumn = (index: number, event: React.MouseEvent) => { event.preventDefault(); const start = event.clientX; const initial = widths[index] || 120; let nextWidth = initial; const move = (current: MouseEvent) => { nextWidth = Math.max(60, initial + current.clientX - start); setWidths((items) => { const next = [...items]; next[index] = nextWidth; return next; }); }; const stop = () => { commit({ ...table, columnWidths: widths.map((width, i) => i === index ? nextWidth : width) }); window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', stop); }; window.addEventListener('mousemove', move); window.addEventListener('mouseup', stop); };
  const resizeRow = (index: number, event: React.MouseEvent) => { event.preventDefault(); const start = event.clientY; const initial = heights[index] || 34; let nextHeight = initial; const move = (current: MouseEvent) => { nextHeight = Math.max(26, initial + current.clientY - start); setHeights((items) => { const next = [...items]; next[index] = nextHeight; return next; }); }; const stop = () => { commit({ ...table, rowHeights: heights.map((height, i) => i === index ? nextHeight : height) }); window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', stop); }; window.addEventListener('mousemove', move); window.addEventListener('mouseup', stop); };
  const action = (fn: () => void) => (event: React.MouseEvent) => { event.preventDefault(); event.stopPropagation(); fn(); };

  return <div className="spreadsheet-editor" tabIndex={0} onKeyDown={keyDown}>
    <div className="spreadsheet-help">Click to select · Shift-click or drag to select a range · Double-click or Enter to edit</div>
    <div className="spreadsheet-scroll"><table ref={tableRef} className="spreadsheet-table"><tbody>{grid.map((row, rowIndex) => <tr key={rowIndex} style={{ height: heights[rowIndex] }}><th className="row-number">{rowIndex + 1}<span onMouseDown={(event) => resizeRow(rowIndex, event)} /></th>{row.map((cell, columnIndex) => { if (!cell || grid[rowIndex - 1]?.[columnIndex]?.id === cell.id || row[columnIndex - 1]?.id === cell.id) return null; const point = { row: rowIndex, column: columnIndex }; const selected = selectedIds.has(cell.id); return <td key={cell.id} colSpan={cell.colSpan || 1} rowSpan={cell.rowSpan || 1} className={selected ? 'spreadsheet-selected' : ''} onMouseDown={(event) => select(point, event)} onMouseEnter={() => dragging && setFocus(point)} onContextMenu={(event) => { event.preventDefault(); if (!selectedIds.has(cell.id)) { setAnchor(point); setFocus(point); } setMenu({ x: event.clientX, y: event.clientY, point }); }} onDoubleClick={() => edit(point)}><input aria-label={`Row ${rowIndex + 1}, column ${columnIndex + 1}`} autoFocus={editing === cell.id} readOnly={editing !== cell.id} value={editing === cell.id ? editValue : cell.content} onChange={(event) => setEditValue(event.target.value)} onBlur={commitEdit} style={{ width: widths[columnIndex], fontSize: cell.fontSize, fontWeight: cell.fontWeight, fontStyle: cell.italic ? 'italic' : 'normal', color: cell.color, backgroundColor: cell.backgroundColor, textAlign: cell.textAlign, verticalAlign: cell.verticalAlign, padding: cell.padding }} />{columnIndex < columns - 1 && <span className="column-resize-handle" onMouseDown={(event) => resizeColumn(columnIndex, event)} />}</td>; })}</tr>)}</tbody></table></div>
    <div className="spreadsheet-status">{points.length ? `${points.length} cell${points.length === 1 ? '' : 's'} selected` : 'No cells selected'}</div>
    {menu && <div className="spreadsheet-menu" style={{ left: menu.x, top: menu.y }} onMouseDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
      <button onMouseDown={action(() => edit(targetPoint))}>Edit</button><button onMouseDown={action(clear)}>Clear</button><button onMouseDown={action(copy)}>Copy</button><button onMouseDown={action(() => void paste())}>Paste</button><hr />
      <button onMouseDown={action(() => addRow(0))}>Insert row above</button><button onMouseDown={action(() => addRow(1))}>Insert row below</button><button onMouseDown={action(deleteRow)}>Delete row</button><button onMouseDown={action(() => addColumn(0))}>Insert column left</button><button onMouseDown={action(() => addColumn(1))}>Insert column right</button><button onMouseDown={action(deleteColumn)}>Delete column</button><hr />
      <button onMouseDown={action(() => apply({ fontWeight: 700 }))}>Bold</button><button onMouseDown={action(() => apply({ italic: true }))}>Italic</button><button onMouseDown={action(() => apply({ textAlign: 'center' }))}>Text alignment</button><button onMouseDown={action(() => apply({ verticalAlign: 'middle' }))}>Vertical alignment</button><label>Text color<input type="color" onChange={(event) => apply({ color: event.target.value })} /></label><label>Background color<input type="color" onChange={(event) => apply({ backgroundColor: event.target.value })} /></label><label>Font size<input type="number" defaultValue="13" onChange={(event) => apply({ fontSize: Number(event.target.value) })} /></label><label>Cell padding<input type="number" defaultValue={table.cellPadding} onChange={(event) => apply({ padding: Number(event.target.value) })} /></label><button onMouseDown={action(() => apply({ borderWidth: 1, borderColor: table.borderColor }))}>Borders</button><hr />
      <button disabled={points.length < 2} onMouseDown={action(merge)}>Merge cells</button><button disabled={!cellAt(active) || !((cellAt(active)?.colSpan || 1) > 1 || (cellAt(active)?.rowSpan || 1) > 1)} onMouseDown={action(unmerge)}>Unmerge</button><button onMouseDown={action(() => update({ ...table, rows: [...table.rows, [makeCell()]] }))}>Add table</button><button onMouseDown={action(() => update({ ...table, rows: [[makeCell()]] }))}>Delete table</button>
    </div>}
  </div>;
}
