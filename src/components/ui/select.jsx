import React from 'react'

// Minimal drop-in replacement for shadcn Select used by this app.
// It renders a native <select> using the labels/values from nested <SelectItem/> children.

const ItemsContext = React.createContext([]);

export const Select = ({ value, onValueChange, children }) => {
  const items = [];
  const walk = (nodes) => React.Children.forEach(nodes, (child) => {
    if (!child) return;
    const type = child.type && (child.type.displayName || child.type.name);
    if (type === 'SelectItem') {
      items.push({ value: String(child.props.value), label: child.props.children });
    }
    if (child.props && child.props.children) walk(child.props.children);
  });
  walk(children);
  return <ItemsContext.Provider value={{ value, onValueChange, items }}>{children}</ItemsContext.Provider>;
}

export const SelectTrigger = ({ className }) => {
  const { value, onValueChange, items } = React.useContext(ItemsContext);
  return (
    <select
      className={(className || '') + ' h-10 w-full rounded-xl border border-black/30 bg-white/80 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/60'}
      value={String(value ?? '')}
      onChange={(e) => onValueChange && onValueChange(e.target.value)}
    >
      {items.map((it) => (
        <option key={it.value} value={it.value}>{it.label}</option>
      ))}
    </select>
  );
}

export const SelectValue = () => null;
export const SelectContent = ({ children }) => <>{children}</>;
export const SelectGroup = ({ children }) => <>{children}</>;
export const SelectLabel = ({ children }) => <optgroup label={children} />;
export const SelectItem = ({ value, children }) => null;
SelectItem.displayName = 'SelectItem';