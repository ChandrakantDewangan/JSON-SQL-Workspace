import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Table as TableIcon, 
  Play, 
  Plus, 
  Trash2, 
  Save, 
  RefreshCw,
  Code,
  LayoutGrid,
  Filter,
  ArrowRightLeft,
  ChevronRight,
  ChevronDown,
  Search
} from 'lucide-react';
import alasql from 'alasql';
import { Toaster, toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';

import { ColumnType, ColumnDefinition } from './types';

// Types
interface TableState {
  name: string;
  data: any[];
  columns: ColumnDefinition[];
}

export default function App() {
  const [tables, setTables] = useState<TableState[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'tables' | 'query'>('tables');
  const [selectedTableName, setSelectedTableName] = useState<string | null>(null);
  const [query, setQuery] = useState<string>('SELECT * FROM users JOIN roles ON users.role_id = roles.id');
  const [queryResult, setQueryResult] = useState<any[] | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);

  // Visual Builder State
  const [vbBaseTable, setVbBaseTable] = useState<string>('users');
  const [vbJoins, setVbJoins] = useState<{ table: string; leftCol: string; rightCol: string }[]>([]);
  const [vbFilters, setVbFilters] = useState<{ column: string; operator: string; value: string }[]>([]);

  useEffect(() => {
    // Auto-generate query from visual builder state
    let newQuery = `SELECT * FROM ${vbBaseTable}`;
    
    vbJoins.forEach(join => {
      newQuery += ` JOIN ${join.table} ON ${vbBaseTable}.${join.leftCol} = ${join.table}.${join.rightCol}`;
    });

    if (vbFilters.length > 0) {
      const filterStrings = vbFilters.map(f => {
        const table = f.column.includes('.') ? '' : `${vbBaseTable}.`;
        const value = isNaN(Number(f.value)) ? `'${f.value}'` : f.value;
        return `${table}${f.column} ${f.operator} ${value}`;
      });
      newQuery += ` WHERE ${filterStrings.join(' AND ')}`;
    }

    setQuery(newQuery);
  }, [vbBaseTable, vbJoins, vbFilters]);

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/tables');
        const tableNames = await res.json();
        
        const tableDataPromises = tableNames.map(async (name: string) => {
          const tableRes = await fetch(`/api/table/${name}`);
          const data = await tableRes.json();
          
          // Infer columns and types from first row
          const columns: ColumnDefinition[] = data.length > 0 
            ? Object.keys(data[0]).map(key => {
                const val = data[0][key];
                let type: ColumnType = 'string';
                if (typeof val === 'number') type = 'number';
                if (typeof val === 'boolean') type = 'boolean';
                return { name: key, type };
              })
            : [];

          return { name, data, columns };
        });

        const loadedTables = await Promise.all(tableDataPromises);
        setTables(loadedTables);
        if (loadedTables.length > 0) setSelectedTableName(loadedTables[0].name);
      } catch (err) {
        toast.error('Failed to load data from backend');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const runQuery = () => {
    try {
      setQueryError(null);
      
      // Register tables with alasql and apply type casting
      tables.forEach(t => {
        const castedData = t.data.map(row => {
          const newRow = { ...row };
          t.columns.forEach(col => {
            const val = newRow[col.name];
            if (val !== undefined && val !== null && val !== '') {
              if (col.type === 'number') {
                const num = Number(val);
                newRow[col.name] = isNaN(num) ? 0 : num;
              } else if (col.type === 'boolean') {
                newRow[col.name] = String(val).toLowerCase() === 'true';
              }
            }
          });
          return newRow;
        });

        // Ensure table is fresh in alasql
        alasql(`DROP TABLE IF EXISTS ${t.name}`);
        alasql(`CREATE TABLE ${t.name}`);
        alasql.tables[t.name].data = castedData;
      });

      // Execute query
      const result = alasql(query);
      
      if (result === undefined || result === null) {
        setQueryResult([]);
        toast.error('Query returned no result');
      } else {
        const processedResult = Array.isArray(result) ? result : [result];
        setQueryResult(processedResult);
        
        if (processedResult.length === 0) {
          toast.error('No rows matched the query');
        } else {
          toast.success(`Query executed: ${processedResult.length} rows found`);
        }
      }
    } catch (err: any) {
      console.error('SQL Execution Error:', err);
      setQueryError(err.message);
      setQueryResult(null);
      toast.error('SQL Error: ' + err.message);
    }
  };

  const updateCell = (tableName: string, rowIndex: number, key: string, value: any) => {
    setTables(prev => prev.map(t => {
      if (t.name === tableName) {
        const newData = [...t.data];
        newData[rowIndex] = { ...newData[rowIndex], [key]: value };
        return { ...t, data: newData };
      }
      return t;
    }));
  };

  const addRow = (tableName: string) => {
    setTables(prev => prev.map(t => {
      if (t.name === tableName) {
        const newRow = t.data.length > 0 
          ? Object.keys(t.data[0]).reduce((acc, key) => ({ ...acc, [key]: '' }), {})
          : { id: Date.now() };
        return { ...t, data: [...t.data, newRow] };
      }
      return t;
    }));
    toast.success('Row added');
  };

  const updateColumnType = (tableName: string, columnName: string, newType: ColumnType) => {
    setTables(prev => prev.map(t => {
      if (t.name === tableName) {
        return {
          ...t,
          columns: t.columns.map(c => c.name === columnName ? { ...c, type: newType } : c)
        };
      }
      return t;
    }));
    toast.success(`Column ${columnName} type updated to ${newType}`);
  };

  const activeTable = tables.find(t => t.name === selectedTableName);
  const columns = activeTable?.columns || [];

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#E4E3E0]">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="animate-spin text-[#141414]" size={32} />
          <p className="font-mono text-sm uppercase tracking-widest">Initializing Data Workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-[#E4E3E0] text-[#141414] flex flex-col font-sans overflow-hidden">
      <Toaster position="bottom-right" />
      
      {/* Header */}
      <header className="h-16 border-b border-[#141414] flex items-center justify-between px-6 bg-white/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Database className="text-[#141414]" size={24} />
          <h1 className="font-serif italic text-xl font-bold tracking-tight">JSON SQL Workspace</h1>
        </div>
        
        <nav className="flex gap-1 bg-[#141414]/5 p-1 rounded-lg">
          <button 
            onClick={() => setActiveTab('tables')}
            className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'tables' ? 'bg-[#141414] text-white shadow-lg' : 'hover:bg-[#141414]/10'}`}
          >
            Data Explorer
          </button>
          <button 
            onClick={() => setActiveTab('query')}
            className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'query' ? 'bg-[#141414] text-white shadow-lg' : 'hover:bg-[#141414]/10'}`}
          >
            SQL Engine
          </button>
        </nav>

        <div className="flex items-center gap-4">
          <div className="text-[10px] font-mono opacity-50 uppercase tracking-widest">
            Status: Connected
          </div>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 border-r border-[#141414] flex flex-col bg-white/30">
          <div className="p-4 border-b border-[#141414]">
            <h2 className="font-serif italic text-xs uppercase opacity-50 tracking-widest mb-4">Available Tables</h2>
            <div className="space-y-1">
              {tables.map(t => (
                <button
                  key={t.name}
                  onClick={() => {
                    setSelectedTableName(t.name);
                    setActiveTab('tables');
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all ${selectedTableName === t.name ? 'bg-[#141414] text-white' : 'hover:bg-[#141414]/10'}`}
                >
                  <TableIcon size={16} />
                  <span className="font-medium">{t.name}</span>
                  <span className="ml-auto text-[10px] opacity-50">{t.data.length}</span>
                </button>
              ))}
            </div>
          </div>
          
          <div className="p-4 flex-1">
            <h2 className="font-serif italic text-xs uppercase opacity-50 tracking-widest mb-4">Quick Actions</h2>
            <div className="space-y-2">
              <button 
                onClick={() => toast.success('Data synced with backend')}
                className="w-full flex items-center gap-2 text-xs font-bold uppercase tracking-wider p-2 border border-[#141414] hover:bg-[#141414] hover:text-white transition-all"
              >
                <RefreshCw size={14} /> Sync Backend
              </button>
              <button 
                onClick={() => {
                  setQuery(`SELECT * FROM ${selectedTableName || 'users'} WHERE id > 1`);
                  setActiveTab('query');
                }}
                className="w-full flex items-center gap-2 text-xs font-bold uppercase tracking-wider p-2 border border-[#141414] hover:bg-[#141414] hover:text-white transition-all"
              >
                <Filter size={14} /> Filter Table
              </button>
              <button 
                onClick={async () => {
                  setLoading(true);
                  try {
                    const res = await fetch('/api/tables');
                    const tableNames = await res.json();
                    const tableDataPromises = tableNames.map(async (name: string) => {
                      const tableRes = await fetch(`/api/table/${name}`);
                      const data = await tableRes.json();
                      return { name, data };
                    });
                    const loadedTables = await Promise.all(tableDataPromises);
                    setTables(loadedTables);
                    toast.success('Data reset to backend state');
                  } catch (err) {
                    toast.error('Failed to reset data');
                  } finally {
                    setLoading(false);
                  }
                }}
                className="w-full flex items-center gap-2 text-xs font-bold uppercase tracking-wider p-2 border border-[#141414] hover:bg-red-500 hover:text-white transition-all"
              >
                <Trash2 size={14} /> Reset to Default
              </button>
            </div>
          </div>
        </aside>

        {/* Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <AnimatePresence mode="wait">
            {activeTab === 'tables' ? (
              <motion.div 
                key="tables"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex-1 flex flex-col overflow-hidden"
              >
                <div className="p-6 border-b border-[#141414] flex items-center justify-between bg-white/20">
                  <div>
                    <h2 className="text-3xl font-serif italic tracking-tight">{selectedTableName}</h2>
                    <p className="text-xs opacity-50 font-mono mt-1 uppercase tracking-widest">Editing raw JSON array as relational table</p>
                  </div>
                  <button 
                    onClick={() => addRow(selectedTableName!)}
                    className="flex items-center gap-2 bg-[#141414] text-white px-4 py-2 rounded-md text-xs font-bold uppercase tracking-widest hover:scale-105 transition-transform"
                  >
                    <Plus size={16} /> Add Row
                  </button>
                </div>

                <div className="flex-1 overflow-auto p-6">
                  <div className="border border-[#141414] rounded-sm overflow-hidden shadow-2xl">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#141414] text-white">
                          <th className="p-3 border-r border-white/10 text-[10px] font-mono uppercase tracking-widest w-12 text-center">#</th>
                          {columns.map(col => (
                            <th key={col.name} className="p-3 border-r border-white/10">
                              <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-mono uppercase tracking-widest">{col.name}</span>
                                <select 
                                  value={col.type}
                                  onChange={(e) => updateColumnType(selectedTableName!, col.name, e.target.value as ColumnType)}
                                  className="bg-white/10 text-[8px] font-mono uppercase p-1 rounded border border-white/20 focus:outline-none cursor-pointer"
                                >
                                  <option value="string" className="text-black">String</option>
                                  <option value="number" className="text-black">Number</option>
                                  <option value="boolean" className="text-black">Boolean</option>
                                </select>
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {activeTable?.data.map((row, idx) => (
                          <tr key={idx} className="border-b border-[#141414] hover:bg-[#141414]/5 transition-colors group">
                            <td className="p-3 border-r border-[#141414]/10 text-[10px] font-mono text-center opacity-50">{idx + 1}</td>
                            {columns.map(col => (
                              <td key={col.name} className="p-0 border-r border-[#141414]/10">
                                <input 
                                  type="text"
                                  value={row[col.name]}
                                  onChange={(e) => updateCell(selectedTableName!, idx, col.name, e.target.value)}
                                  className="w-full p-3 bg-transparent focus:bg-white focus:outline-none font-mono text-sm transition-all"
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="query"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex-1 flex flex-col overflow-hidden p-6 gap-6"
              >
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-3xl font-serif italic tracking-tight">SQL Query Engine</h2>
                      <p className="text-xs opacity-50 font-mono mt-1 uppercase tracking-widest">Perform joins and complex operations on local JSON state</p>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          const table = tables[0]?.name || 'users';
                          setQuery(`SELECT * FROM ${table}`);
                          toast.success('Template loaded');
                        }}
                        className="flex items-center gap-2 border border-[#141414] px-4 py-2 rounded-md text-xs font-bold uppercase tracking-widest hover:bg-[#141414] hover:text-white transition-all"
                      >
                        Visual Builder
                      </button>
                      <button 
                        onClick={runQuery}
                        className="flex items-center gap-2 bg-[#141414] text-white px-6 py-3 rounded-md text-sm font-bold uppercase tracking-widest hover:scale-105 transition-transform shadow-xl"
                      >
                        <Play size={18} fill="currentColor" /> Execute Query
                      </button>
                    </div>
                  </div>

                  {/* Visual Builder UI */}
                  <div className="flex flex-col gap-6 bg-white/40 p-6 rounded-lg border border-[#141414]/10 shadow-inner">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                      {/* Step 1: Base Table */}
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-[#141414] text-white flex items-center justify-center text-[10px] font-bold">1</div>
                          <label className="text-xs font-bold uppercase tracking-widest">Primary Table</label>
                        </div>
                        <select 
                          value={vbBaseTable}
                          onChange={(e) => {
                            setVbBaseTable(e.target.value);
                            setVbJoins([]);
                            setVbFilters([]);
                          }}
                          className="w-full p-3 border border-[#141414] rounded bg-white font-mono text-sm shadow-sm focus:ring-2 ring-[#141414]/10 outline-none"
                        >
                          {tables.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                        </select>
                      </div>

                      {/* Step 2: Joins */}
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-[#141414] text-white flex items-center justify-center text-[10px] font-bold">2</div>
                            <label className="text-xs font-bold uppercase tracking-widest">Connect Data (Joins)</label>
                          </div>
                          <button 
                            onClick={() => setVbJoins([...vbJoins, { table: tables.find(t => t.name !== vbBaseTable)?.name || '', leftCol: 'id', rightCol: 'id' }])}
                            className="text-[10px] font-bold uppercase underline hover:opacity-70"
                          >
                            + Add Join
                          </button>
                        </div>
                        
                        <div className="space-y-3">
                          {vbJoins.map((join, idx) => (
                            <div key={idx} className="flex flex-col gap-2 p-3 bg-white/50 border border-[#141414]/5 rounded relative group">
                              <button 
                                onClick={() => setVbJoins(vbJoins.filter((_, i) => i !== idx))}
                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Trash2 size={10} />
                              </button>
                              <div className="flex items-center gap-2 text-[10px] font-mono opacity-50">
                                JOIN <span className="font-bold text-[#141414]">{join.table}</span> ON
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <select 
                                  value={join.table}
                                  onChange={(e) => {
                                    const newJoins = [...vbJoins];
                                    newJoins[idx].table = e.target.value;
                                    setVbJoins(newJoins);
                                  }}
                                  className="p-1.5 border border-[#141414]/20 rounded text-[10px] font-mono"
                                >
                                  {tables.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                                </select>
                                <div className="flex items-center gap-1">
                                  <select 
                                    value={join.leftCol}
                                    onChange={(e) => {
                                      const newJoins = [...vbJoins];
                                      newJoins[idx].leftCol = e.target.value;
                                      setVbJoins(newJoins);
                                    }}
                                    className="flex-1 p-1.5 border border-[#141414]/20 rounded text-[10px] font-mono"
                                  >
                                    {tables.find(t => t.name === vbBaseTable)?.columns.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                                  </select>
                                  <span className="text-[10px]">=</span>
                                  <select 
                                    value={join.rightCol}
                                    onChange={(e) => {
                                      const newJoins = [...vbJoins];
                                      newJoins[idx].rightCol = e.target.value;
                                      setVbJoins(newJoins);
                                    }}
                                    className="flex-1 p-1.5 border border-[#141414]/20 rounded text-[10px] font-mono"
                                  >
                                    {tables.find(t => t.name === join.table)?.columns.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                                  </select>
                                </div>
                              </div>
                            </div>
                          ))}
                          {vbJoins.length === 0 && <div className="text-[10px] italic opacity-40 text-center py-4 border border-dashed border-[#141414]/20 rounded">No joins defined</div>}
                        </div>
                      </div>

                      {/* Step 3: Filters */}
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-[#141414] text-white flex items-center justify-center text-[10px] font-bold">3</div>
                            <label className="text-xs font-bold uppercase tracking-widest">Refine Results (Where)</label>
                          </div>
                          <button 
                            onClick={() => setVbFilters([...vbFilters, { column: tables.find(t => t.name === vbBaseTable)?.columns[0].name || '', operator: '=', value: '' }])}
                            className="text-[10px] font-bold uppercase underline hover:opacity-70"
                          >
                            + Add Filter
                          </button>
                        </div>

                        <div className="space-y-3">
                          {vbFilters.map((filter, idx) => (
                            <div key={idx} className="flex flex-col gap-2 p-3 bg-white/50 border border-[#141414]/5 rounded relative group">
                              <button 
                                onClick={() => setVbFilters(vbFilters.filter((_, i) => i !== idx))}
                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Trash2 size={10} />
                              </button>
                              <div className="grid grid-cols-3 gap-2">
                                <select 
                                  value={filter.column}
                                  onChange={(e) => {
                                    const newFilters = [...vbFilters];
                                    newFilters[idx].column = e.target.value;
                                    setVbFilters(newFilters);
                                  }}
                                  className="p-1.5 border border-[#141414]/20 rounded text-[10px] font-mono"
                                >
                                  {tables.find(t => t.name === vbBaseTable)?.columns.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                                  {vbJoins.map(j => tables.find(t => t.name === j.table)?.columns.map(c => (
                                    <option key={`${j.table}.${c.name}`} value={`${j.table}.${c.name}`}>{j.table}.{c.name}</option>
                                  )))}
                                </select>
                                <select 
                                  value={filter.operator}
                                  onChange={(e) => {
                                    const newFilters = [...vbFilters];
                                    newFilters[idx].operator = e.target.value;
                                    setVbFilters(newFilters);
                                  }}
                                  className="p-1.5 border border-[#141414]/20 rounded text-[10px] font-mono"
                                >
                                  <option value="=">=</option>
                                  <option value=">">&gt;</option>
                                  <option value="<">&lt;</option>
                                  <option value="LIKE">LIKE</option>
                                  <option value="!=">!=</option>
                                </select>
                                <input 
                                  type="text"
                                  value={filter.value}
                                  placeholder="Value..."
                                  onChange={(e) => {
                                    const newFilters = [...vbFilters];
                                    newFilters[idx].value = e.target.value;
                                    setVbFilters(newFilters);
                                  }}
                                  className="p-1.5 border border-[#141414]/20 rounded text-[10px] font-mono focus:outline-none focus:ring-1 ring-[#141414]/20"
                                />
                              </div>
                            </div>
                          ))}
                          {vbFilters.length === 0 && <div className="text-[10px] italic opacity-40 text-center py-4 border border-dashed border-[#141414]/20 rounded">No filters applied</div>}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-[#141414] to-[#141414]/50 rounded-lg blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                    <div className="relative">
                      <div className="absolute top-3 left-4 text-[#141414]/30 pointer-events-none">
                        <Code size={20} />
                      </div>
                      <textarea 
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        spellCheck={false}
                        className="w-full h-40 p-10 bg-white border border-[#141414] rounded-lg font-mono text-lg focus:outline-none focus:ring-2 ring-[#141414]/20 shadow-inner"
                        placeholder="SELECT * FROM users JOIN roles ON users.role_id = roles.id"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="flex items-center gap-2 mb-4">
                    <LayoutGrid size={18} />
                    <h3 className="font-serif italic text-lg">Result Set</h3>
                    {queryResult && (
                      <span className="text-[10px] font-mono bg-[#141414] text-white px-2 py-0.5 rounded-full uppercase tracking-widest ml-2">
                        {queryResult.length} Rows
                      </span>
                    )}
                  </div>

                  <div className="flex-1 overflow-auto border border-[#141414] rounded-sm bg-white/50">
                    {queryError ? (
                      <div className="h-full flex items-center justify-center p-12 text-center">
                        <div className="max-w-md">
                          <Trash2 className="mx-auto text-red-500 mb-4" size={48} />
                          <h4 className="font-serif italic text-xl text-red-600 mb-2">Syntax Error</h4>
                          <p className="font-mono text-sm opacity-70">{queryError}</p>
                        </div>
                      </div>
                    ) : queryResult && queryResult.length > 0 ? (
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-[#141414] text-white sticky top-0 z-10">
                            {typeof queryResult[0] === 'object' && queryResult[0] !== null ? (
                              Object.keys(queryResult[0]).map(col => (
                                <th key={col} className="p-3 border-r border-white/10 text-[10px] font-mono uppercase tracking-widest">
                                  {col}
                                </th>
                              ))
                            ) : (
                              <th className="p-3 border-r border-white/10 text-[10px] font-mono uppercase tracking-widest">
                                Result
                              </th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {queryResult.map((row, idx) => (
                            <tr key={idx} className="border-b border-[#141414]/20 hover:bg-[#141414]/5 transition-colors">
                              {typeof row === 'object' && row !== null ? (
                                Object.values(row).map((val: any, i) => (
                                  <td key={i} className="p-3 border-r border-[#141414]/10 font-mono text-sm">
                                    {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                                  </td>
                                ))
                              ) : (
                                <td className="p-3 border-r border-[#141414]/10 font-mono text-sm">
                                  {String(row)}
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center opacity-30">
                        <Search size={48} className="mb-4" />
                        <p className="font-serif italic text-xl">
                          {queryResult?.length === 0 ? 'No results found' : 'No results to display'}
                        </p>
                        <p className="text-[10px] font-mono uppercase tracking-widest mt-2">
                          {queryResult?.length === 0 ? 'Try adjusting your query or filters' : 'Run a query to see data here'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Footer / Status Bar */}
      <footer className="h-8 border-t border-[#141414] bg-white flex items-center px-6 justify-between text-[9px] font-mono uppercase tracking-[0.2em] opacity-60">
        <div className="flex gap-6">
          <span>Engine: AlaSQL v4.0</span>
          <span>Mode: Local State Sync</span>
        </div>
        <div className="flex gap-6">
          <span>Tables: {tables.length}</span>
          <span>Memory: {(JSON.stringify(tables).length / 1024).toFixed(2)} KB</span>
        </div>
      </footer>
    </div>
  );
}
