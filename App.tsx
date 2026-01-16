
import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { 
  FileSpreadsheet, 
  Upload, 
  Settings, 
  Table as TableIcon, 
  Download, 
  Trash2, 
  AlertCircle,
  Loader2,
  CheckCircle2,
  Info
} from 'lucide-react';
import { ExcelFile, ComparisonConfig, AppStep, MergedRow } from './types';
import { isMatch } from './utils/fuzzy';

const App: React.FC = () => {
  const [files, setFiles] = useState<ExcelFile[]>([]);
  const [config, setConfig] = useState<ComparisonConfig>({
    masterColumn: '',
    similarityThreshold: 0.85
  });
  const [step, setStep] = useState<AppStep>(AppStep.Upload);
  const [mergedData, setMergedData] = useState<MergedRow[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = e.target.files;
    if (!uploadedFiles) return;

    const newFiles: ExcelFile[] = [];
    
    for (let i = 0; i < uploadedFiles.length; i++) {
      if (files.length + newFiles.length >= 5) break;
      
      const file = uploadedFiles[i];
      const data = await new Promise<any[]>((resolve) => {
        const reader = new FileReader();
        reader.onload = (evt) => {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const json = XLSX.utils.sheet_to_json(ws);
          resolve(json);
        };
        reader.readAsBinaryString(file);
      });

      if (data.length > 0) {
        newFiles.push({
          id: Math.random().toString(36).substr(2, 9),
          name: file.name,
          data,
          columns: Object.keys(data[0])
        });
      }
    }

    setFiles(prev => [...prev, ...newFiles]);
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const commonColumns = useMemo(() => {
    if (files.length === 0) return [];
    // Recopilamos todas las columnas únicas de todos los archivos para asegurar que el usuario pueda elegir
    const allCols = new Set<string>();
    files.forEach(f => f.columns.forEach(c => allCols.add(c)));
    return Array.from(allCols);
  }, [files]);

  const handleMerge = () => {
    setStep(AppStep.Processing);
    
    setTimeout(() => {
      const masterCol = config.masterColumn;
      const threshold = config.similarityThreshold;
      const pool: MergedRow[] = [];

      files.forEach((file, fileIdx) => {
        const listKey = `Lista${fileIdx + 1}_`;
        
        file.data.forEach((row) => {
          const masterVal = row[masterCol];
          
          // Buscamos un hueco en el pool:
          // 1. Que el valor maestro coincida
          // 2. Y que esa entrada NO tenga ya datos de ESTA lista (evita colapsar una misma lista)
          let matchIndex = -1;
          
          // Solo intentamos buscar match si el valor maestro no está vacío
          if (masterVal !== undefined && masterVal !== null && String(masterVal).trim() !== '') {
            for (let i = 0; i < pool.length; i++) {
              const existingMasterVal = pool[i][`_master_val`];
              const isSlotAvailable = !pool[i][`${listKey}${masterCol}`] && pool[i][`${listKey}${masterCol}`] !== 0;
              
              if (isSlotAvailable && isMatch(masterVal, existingMasterVal, threshold)) {
                matchIndex = i;
                break;
              }
            }
          }

          if (matchIndex === -1) {
            // Crear nueva fila en el pool
            const newRow: MergedRow = { _master_val: masterVal };
            // Inicializar todas las columnas de todas las listas posibles para mantener estructura
            files.forEach((f, fIdx) => {
              f.columns.forEach(col => {
                newRow[`Lista${fIdx + 1}_${col}`] = '';
              });
            });
            // Rellenar datos de la lista actual
            file.columns.forEach(col => {
              newRow[`${listKey}${col}`] = row[col] ?? '';
            });
            pool.push(newRow);
          } else {
            // Fusionar en fila existente
            file.columns.forEach(col => {
              pool[matchIndex][`${listKey}${col}`] = row[col] ?? '';
            });
          }
        });
      });

      // Limpiar metadatos internos y establecer resultados
      const finalResult = pool.map(({ _master_val, ...rest }) => rest);
      setMergedData(finalResult);
      setStep(AppStep.Results);
    }, 150);
  };

  const exportToExcel = () => {
    setIsExporting(true);
    try {
      const ws = XLSX.utils.json_to_sheet(mergedData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Comparativa_Listas");
      XLSX.writeFile(wb, "Excel_Lists_Compare_Result.xlsx");
    } catch (error) {
      console.error("Error exporting:", error);
      alert("Hubo un error al generar el archivo Excel.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-indigo-700 text-white py-8 shadow-lg">
        <div className="container mx-auto px-4 flex items-center gap-4">
          <div className="p-3 bg-white/20 rounded-xl">
            <FileSpreadsheet size={40} />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Excel's Lists Compare</h1>
            <p className="text-indigo-100 opacity-90 font-medium">Comparación y fusión inteligente de catálogos</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow container mx-auto px-4 py-8">
        
        {/* Progress Stepper */}
        <div className="flex justify-center mb-12">
          <div className="flex items-center w-full max-w-3xl">
            {[
              { s: AppStep.Upload, i: <Upload size={20}/>, l: 'Subida' },
              { s: AppStep.Configure, i: <Settings size={20}/>, l: 'Ajustes' },
              { s: AppStep.Results, i: <TableIcon size={20}/>, l: 'Resultados' }
            ].map((item, idx, arr) => {
              const isActive = step === item.s;
              const isDone = mergedData.length > 0 && item.s !== AppStep.Results || (step === AppStep.Configure && idx === 0);
              return (
                <React.Fragment key={item.s}>
                  <div className="flex flex-col items-center relative z-10">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                      isActive ? 'bg-indigo-600 text-white ring-4 ring-indigo-100 shadow-lg' : 
                      isDone ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
                    }`}>
                      {item.i}
                    </div>
                    <span className={`absolute -bottom-7 text-sm font-bold whitespace-nowrap transition-colors ${isActive ? 'text-indigo-700' : 'text-gray-500'}`}>
                      {item.l}
                    </span>
                  </div>
                  {idx < arr.length - 1 && (
                    <div className={`flex-grow h-1 mx-4 rounded transition-all duration-500 ${
                      isDone ? 'bg-green-500' : 'bg-gray-200'
                    }`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Dynamic Card Container */}
        <div className="bg-white rounded-3xl shadow-2xl p-8 border border-gray-100 overflow-hidden">
          
          {step === AppStep.Upload && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="text-center max-w-2xl mx-auto">
                <h2 className="text-2xl font-bold text-gray-800 mb-3">1. Carga de Archivos</h2>
                <p className="text-gray-500">Sube entre 2 y 5 archivos Excel para compararlos. Analizaremos las filas una a una para buscar coincidencias.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {files.map((file, idx) => (
                  <div key={file.id} className="group relative bg-indigo-50 border-2 border-indigo-100 p-5 rounded-2xl flex items-center gap-4 transition-all hover:border-indigo-300 hover:shadow-xl">
                    <div className="w-12 h-12 bg-indigo-600 text-white rounded-xl flex items-center justify-center font-black text-lg shadow-inner">
                      {idx + 1}
                    </div>
                    <div className="flex-grow min-w-0">
                      <p className="font-bold text-gray-800 truncate" title={file.name}>{file.name}</p>
                      <p className="text-xs text-indigo-600 font-bold uppercase tracking-widest bg-indigo-100/50 inline-block px-2 py-0.5 rounded-md mt-1">
                        {file.data.length} Filas
                      </p>
                    </div>
                    <button 
                      onClick={() => removeFile(file.id)}
                      className="text-gray-400 hover:text-red-500 p-2 rounded-full hover:bg-white transition-all shadow-sm"
                      title="Eliminar archivo"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                ))}

                {files.length < 5 && (
                  <label className="border-3 border-dashed border-gray-200 rounded-2xl p-10 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 transition-all group relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/0 to-indigo-50/0 group-hover:to-indigo-50/40 transition-all" />
                    <div className="w-16 h-16 bg-gray-50 group-hover:bg-indigo-100 rounded-2xl flex items-center justify-center text-gray-400 group-hover:text-indigo-600 mb-4 transition-all transform group-hover:scale-110 shadow-sm">
                      <Upload size={32} />
                    </div>
                    <span className="font-bold text-gray-700 group-hover:text-indigo-700">Añadir Archivo Excel</span>
                    <span className="text-xs text-gray-400 mt-2 font-medium">Formato .xlsx / .xls</span>
                    <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleFileUpload} multiple />
                  </label>
                )}
              </div>

              <div className="flex justify-center pt-8">
                <button
                  disabled={files.length < 2}
                  onClick={() => setStep(AppStep.Configure)}
                  className={`group px-10 py-4 rounded-2xl font-black text-lg transition-all shadow-xl flex items-center gap-3 ${
                    files.length >= 2 
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700 hover:-translate-y-1 active:translate-y-0' 
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
                  }`}
                >
                  Configurar Comparación
                  <Settings size={22} className="group-hover:rotate-45 transition-transform" />
                </button>
              </div>
            </div>
          )}

          {step === AppStep.Configure && (
            <div className="space-y-10 animate-in slide-in-from-right-12 duration-500">
              <div className="text-center max-w-2xl mx-auto">
                <h2 className="text-2xl font-bold text-gray-800 mb-3">2. Parámetros de Fusión</h2>
                <p className="text-gray-500">Configura cómo el sistema debe identificar si dos filas de distintas listas son la misma.</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 max-w-5xl mx-auto items-start">
                <div className="space-y-6">
                  <label className="block bg-gray-50 p-6 rounded-2xl border border-gray-200">
                    <span className="text-gray-900 font-black text-lg mb-4 block flex items-center gap-3">
                      <div className="w-8 h-8 bg-indigo-100 text-indigo-700 rounded-lg flex items-center justify-center">
                         <CheckCircle2 size={18} />
                      </div>
                      Columna Maestra (ID)
                    </span>
                    <select 
                      value={config.masterColumn}
                      onChange={(e) => setConfig({ ...config, masterColumn: e.target.value })}
                      className="w-full bg-white border-2 border-gray-200 rounded-xl px-5 py-4 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all outline-none font-semibold text-gray-700 shadow-sm"
                    >
                      <option value="">Selecciona la columna común...</option>
                      {commonColumns.map(col => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                  </label>

                  <div className="bg-indigo-50 border-l-4 border-indigo-500 p-5 rounded-r-2xl flex items-start gap-4">
                    <Info className="text-indigo-600 shrink-0 mt-1" size={24} />
                    <div className="text-sm text-indigo-900 leading-relaxed">
                      <p className="font-bold mb-1">Nota importante:</p>
                      Las filas se unirán solo si el valor en esta columna es similar. Si el valor está vacío, se tratará como una fila independiente para evitar errores de omisión.
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <label className="block bg-gray-50 p-6 rounded-2xl border border-gray-200">
                    <span className="text-gray-900 font-black text-lg mb-4 block flex items-center gap-3">
                      <div className="w-8 h-8 bg-amber-100 text-amber-700 rounded-lg flex items-center justify-center">
                        <Settings size={18} />
                      </div>
                      Sensibilidad de Texto
                    </span>
                    <div className="px-2">
                      <div className="flex justify-between text-xs font-black text-gray-400 mb-2 uppercase tracking-tighter">
                        <span>Más Flexible (Fuzzy)</span>
                        <span>Más Estricto (Exacto)</span>
                      </div>
                      <input 
                        type="range" 
                        min="0.5" 
                        max="1" 
                        step="0.01"
                        value={config.similarityThreshold}
                        onChange={(e) => setConfig({ ...config, similarityThreshold: parseFloat(e.target.value) })}
                        className="w-full h-3 bg-gray-200 rounded-full appearance-none cursor-pointer accent-indigo-600"
                      />
                      <div className="mt-6 flex items-center justify-center">
                         <div className="text-center">
                           <span className="block text-4xl font-black text-indigo-600">
                             {Math.round(config.similarityThreshold * 100)}%
                           </span>
                           <span className="text-xs font-bold text-gray-400 uppercase">Umbral de similitud</span>
                         </div>
                      </div>
                    </div>
                  </label>
                  <p className="text-xs text-gray-400 bg-white p-3 rounded-lg border border-gray-100 font-medium italic text-center">
                    Los números y códigos cortos siempre requieren una coincidencia exacta al 100% independientemente de este ajuste.
                  </p>
                </div>
              </div>

              <div className="flex justify-center gap-6 pt-10 border-t border-gray-100">
                <button
                  onClick={() => setStep(AppStep.Upload)}
                  className="px-10 py-4 rounded-2xl font-bold text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-all"
                >
                  Volver Atrás
                </button>
                <button
                  disabled={!config.masterColumn}
                  onClick={handleMerge}
                  className={`px-12 py-4 rounded-2xl font-black text-lg transition-all shadow-xl flex items-center gap-3 ${
                    config.masterColumn 
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700 hover:-translate-y-1 active:translate-y-0' 
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
                  }`}
                >
                  Iniciar Fusión
                  <CheckCircle2 size={24} />
                </button>
              </div>
            </div>
          )}

          {step === AppStep.Processing && (
            <div className="py-24 flex flex-col items-center justify-center animate-pulse">
              <div className="relative">
                <Loader2 size={80} className="text-indigo-600 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <FileSpreadsheet size={32} className="text-indigo-300" />
                </div>
              </div>
              <h3 className="text-2xl font-black text-gray-800 mt-8 tracking-tight">Fusionando Listas...</h3>
              <p className="text-gray-500 mt-3 font-medium">Estamos aplicando algoritmos de Levenshtein y preservando la integridad de tus datos.</p>
            </div>
          )}

          {step === AppStep.Results && (
            <div className="space-y-8 animate-in zoom-in-95 duration-700">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-gray-100">
                <div>
                  <h2 className="text-3xl font-black text-gray-800 mb-2">3. Fusión Completada</h2>
                  <div className="flex flex-wrap gap-4 mt-4">
                    <div className="bg-indigo-600 text-white px-5 py-2 rounded-2xl shadow-md">
                      <span className="text-xs uppercase font-black opacity-70 block">Total Filas Resultantes</span>
                      <span className="text-2xl font-black">{mergedData.length}</span>
                    </div>
                    {files.map((f, i) => (
                       <div key={f.id} className="bg-gray-100 border border-gray-200 px-4 py-2 rounded-2xl">
                        <span className="text-[10px] uppercase font-black text-gray-400 block">Lista {i+1}</span>
                        <span className="text-lg font-black text-gray-700">{f.data.length} filas</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-3">
                   <button
                    onClick={() => setStep(AppStep.Configure)}
                    className="px-6 py-3 rounded-2xl font-bold text-gray-600 hover:bg-gray-100 border-2 border-gray-100 transition-all flex items-center gap-2"
                  >
                    Ajustar Sensibilidad
                  </button>
                  <button
                    onClick={exportToExcel}
                    disabled={isExporting}
                    className="bg-green-600 hover:bg-green-700 text-white px-10 py-3 rounded-2xl font-black shadow-xl flex items-center gap-3 transition-all hover:-translate-y-1 active:translate-y-0"
                  >
                    {isExporting ? <Loader2 className="animate-spin" /> : <Download size={24} />}
                    Descargar Excel Final
                  </button>
                </div>
              </div>

              <div className="relative group">
                <div className="overflow-x-auto border-2 border-gray-100 rounded-3xl bg-gray-50/50 shadow-inner">
                  <table className="min-w-full divide-y-2 divide-gray-100">
                    <thead className="bg-gray-100/80">
                      <tr>
                        {Object.keys(mergedData[0] || {}).slice(0, 12).map(col => (
                          <th key={col} className="px-6 py-4 text-left text-[10px] font-black text-gray-500 uppercase tracking-widest border-r border-gray-200/50 last:border-0">
                            {col.replace('Lista', 'L')}
                          </th>
                        ))}
                        {Object.keys(mergedData[0] || {}).length > 12 && (
                          <th className="px-6 py-4 text-left text-xs font-black text-gray-400">...</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {mergedData.slice(0, 15).map((row, idx) => (
                        <tr key={idx} className="hover:bg-indigo-50/40 transition-colors group/row">
                          {Object.keys(row).slice(0, 12).map(col => (
                            <td key={col} className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-600 border-r border-gray-50 last:border-0">
                              {row[col] !== '' ? row[col] : <span className="text-gray-200">-</span>}
                            </td>
                          ))}
                          {Object.keys(row).length > 12 && (
                            <td className="px-6 py-4 text-[10px] text-gray-300 italic font-bold">Datos ocultos en vista previa</td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-white to-transparent pointer-events-none rounded-b-3xl" />
              </div>
              
              <div className="bg-amber-50 border-2 border-amber-100 p-6 rounded-3xl flex items-center gap-5">
                <div className="w-14 h-14 bg-amber-400 text-white rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-amber-200">
                  <AlertCircle size={32} />
                </div>
                <p className="text-amber-900 font-bold leading-tight">
                  Previsualización limitada a las primeras 15 filas y 12 columnas. El archivo Excel generado incluirá el 100% de los datos fusionados de todas las listas.
                </p>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-16 mt-auto border-t border-gray-800">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
            <div className="col-span-1 lg:col-span-2">
              <div className="flex items-center gap-3 text-white mb-6">
                <FileSpreadsheet size={32} className="text-indigo-500" />
                <span className="text-2xl font-black">Excel's Lists Compare</span>
              </div>
              <p className="text-sm leading-relaxed max-w-md">
                Herramienta profesional diseñada para facilitar la comparación de catálogos comerciales, presupuestos y listas de materiales utilizando inteligencia de datos local. Tus datos nunca salen de tu equipo.
              </p>
            </div>
            <div>
              <h4 className="text-white font-black mb-6 uppercase text-xs tracking-widest">Tecnología</h4>
              <ul className="space-y-4 text-sm font-bold">
                <li>Algoritmo Levenshtein</li>
                <li>Fusión Multidireccional</li>
                <li>Procesamiento en Cliente</li>
                <li>Privacidad Garantizada</li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-black mb-6 uppercase text-xs tracking-widest">Información</h4>
              <ul className="space-y-4 text-sm font-bold">
                <li><a href="#" className="hover:text-indigo-400 transition-colors">Guía de Uso</a></li>
                <li><a href="#" className="hover:text-indigo-400 transition-colors">FAQ</a></li>
                <li><a href="#" className="hover:text-indigo-400 transition-colors">Seguridad de Datos</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-12 border-t border-gray-800 text-center text-xs font-black tracking-widest uppercase">
            Aitor Sánchez Gutiérrez © 2026 - Reservados todos los derechos
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
