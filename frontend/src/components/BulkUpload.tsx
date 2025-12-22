import { useState, useCallback, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button } from './ui';
import type { ColumnMapping, DataSource } from '../types';

// Database fields that can be mapped to CSV columns
const DB_FIELDS: { field: string; label: string; category: string }[] = [
  // Basic Info
  { field: 'address', label: 'Property Address', category: 'Basic' },
  { field: 'property_name', label: 'Property Name', category: 'Basic' },
  { field: 'building_park', label: 'Building Park', category: 'Basic' },

  // Location
  { field: 'city', label: 'City', category: 'Location' },
  { field: 'state', label: 'State', category: 'Location' },
  { field: 'zip', label: 'Zip Code', category: 'Location' },
  { field: 'county', label: 'County', category: 'Location' },
  { field: 'submarket', label: 'Submarket', category: 'Location' },

  // Classification
  { field: 'property_type', label: 'Property Type', category: 'Classification' },
  { field: 'property_subtype', label: 'Property Subtype', category: 'Classification' },
  { field: 'building_status', label: 'Building Status', category: 'Classification' },
  { field: 'building_class', label: 'Building Class', category: 'Classification' },
  { field: 'zoning', label: 'Zoning', category: 'Classification' },

  // Size
  { field: 'building_size', label: 'Building Size (SF)', category: 'Size' },
  { field: 'land_area_sf', label: 'Land Area (SF)', category: 'Size' },
  { field: 'lot_size_acres', label: 'Lot Size (Acres)', category: 'Size' },

  // Building Details
  { field: 'year_built', label: 'Year Built', category: 'Details' },
  { field: 'year_renovated', label: 'Year Renovated', category: 'Details' },
  { field: 'number_of_floors', label: 'Number of Floors', category: 'Details' },
  { field: 'number_of_units', label: 'Number of Units', category: 'Details' },

  // Industrial
  { field: 'clear_height_ft', label: 'Clear Height (ft)', category: 'Industrial' },
  { field: 'dock_doors', label: 'Dock Doors', category: 'Industrial' },
  { field: 'grade_doors', label: 'Grade Doors', category: 'Industrial' },
  { field: 'rail_served', label: 'Rail Served', category: 'Industrial' },
  { field: 'office_percentage', label: 'Office %', category: 'Industrial' },

  // Retail
  { field: 'parking_spaces', label: 'Parking Spaces', category: 'Retail' },
  { field: 'parking_ratio', label: 'Parking Ratio', category: 'Retail' },
  { field: 'anchor_tenant', label: 'Anchor Tenant', category: 'Retail' },

  // Status
  { field: 'percent_leased', label: 'Percent Leased', category: 'Status' },

  // Contacts
  { field: 'owner_name', label: 'Owner Name', category: 'Contacts' },
  { field: 'owner_contact', label: 'Owner Contact', category: 'Contacts' },
  { field: 'owner_address', label: 'Owner Address', category: 'Contacts' },
  { field: 'property_manager_name', label: 'Property Manager', category: 'Contacts' },
  { field: 'property_manager_phone', label: 'Property Manager Phone', category: 'Contacts' },
  { field: 'leasing_company_name', label: 'Leasing Company', category: 'Contacts' },
  { field: 'leasing_company_phone', label: 'Leasing Company Phone', category: 'Contacts' },
  { field: 'leasing_company_contact', label: 'Leasing Contact', category: 'Contacts' },
  { field: 'developer_name', label: 'Developer', category: 'Contacts' },
  { field: 'architect_name', label: 'Architect', category: 'Contacts' },

  // IDs
  { field: 'costar_id', label: 'CoStar ID', category: 'External IDs' },
  { field: 'crexi_id', label: 'Crexi ID', category: 'External IDs' },

  // Transaction Fields
  { field: 'sale_price', label: 'Sale Price', category: 'Transaction' },
  { field: 'price_per_sf', label: 'Price per SF', category: 'Transaction' },
  { field: 'cap_rate', label: 'Cap Rate', category: 'Transaction' },
  { field: 'noi', label: 'NOI', category: 'Transaction' },
  { field: 'transaction_date', label: 'Sale/Transaction Date', category: 'Transaction' },
  { field: 'buyer_name', label: 'Buyer', category: 'Transaction' },
  { field: 'seller_name', label: 'Seller', category: 'Transaction' },
];

// Auto-mapping suggestions based on common column names
const AUTO_MAP_HINTS: Record<string, string[]> = {
  address: ['property address', 'address', 'street address', 'location'],
  property_name: ['property name', 'name', 'building name'],
  building_park: ['building park', 'park name', 'park'],
  city: ['city', 'property city'],
  state: ['state', 'property state', 'st'],
  zip: ['zip', 'zip code', 'zipcode', 'postal code'],
  county: ['county', 'county name'],
  property_type: ['property type', 'type', 'asset type'],
  building_status: ['building status', 'status'],
  building_class: ['building class', 'class'],
  building_size: ['rba', 'building size', 'sf', 'square feet', 'sqft', 'size'],
  land_area_sf: ['land area', 'land area (sf)', 'land sf', 'lot sf'],
  year_built: ['year built', 'built', 'year'],
  percent_leased: ['percent leased', 'leased', 'occupancy', 'leased %'],
  owner_name: ['owner name', 'owner'],
  owner_contact: ['owner contact'],
  property_manager_name: ['property manager name', 'property manager', 'manager'],
  property_manager_phone: ['property manager phone', 'manager phone'],
  leasing_company_name: ['leasing company name', 'leasing company'],
  leasing_company_phone: ['leasing company phone'],
  leasing_company_contact: ['leasing company contact', 'leasing contact'],
  developer_name: ['developer name', 'developer'],
  architect_name: ['architect name', 'architect'],
  costar_id: ['propertyid', 'property id', 'costar id'],
  sale_price: ['sale price', 'price', 'sold price'],
  cap_rate: ['cap rate', 'cap'],
};

interface BulkUploadProps {
  onComplete?: () => void;
}

type Step = 'upload' | 'mapping' | 'preview' | 'importing' | 'complete';

interface ParsedCSV {
  headers: string[];
  rows: Record<string, string>[];
}

export default function BulkUpload({ onComplete }: BulkUploadProps) {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState<DataSource>('costar');
  const [parsedData, setParsedData] = useState<ParsedCSV | null>(null);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    imported: number;
    skipped: number;
    errors: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Detect the delimiter used in the CSV
  const detectDelimiter = useCallback((text: string): string => {
    const firstLine = text.split(/\r?\n/)[0] || '';

    // Count occurrences of common delimiters (outside of quotes)
    const delimiters = [',', '\t', ';', '|'];
    const counts: Record<string, number> = {};

    for (const delim of delimiters) {
      let count = 0;
      let inQuotes = false;
      for (const char of firstLine) {
        if (char === '"') inQuotes = !inQuotes;
        if (char === delim && !inQuotes) count++;
      }
      counts[delim] = count;
    }

    // Return delimiter with highest count
    const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    console.log('[BulkUpload] Delimiter detection:', counts, 'Selected:', best?.[0] || ',');
    return best && best[1] > 0 ? best[0] : ',';
  }, []);

  // Parse a single CSV line (handles quoted values)
  const parseCSVLine = useCallback((line: string, delimiter: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"' && !inQuotes) {
        inQuotes = true;
      } else if (char === '"' && inQuotes) {
        if (nextChar === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = false;
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());

    return result;
  }, []);

  // Parse CSV file
  const parseCSV = useCallback((text: string): ParsedCSV => {
    // Remove BOM if present
    const cleanText = text.replace(/^\uFEFF/, '');

    const lines = cleanText.split(/\r?\n/).filter(line => line.trim());
    if (lines.length === 0) {
      throw new Error('Empty file');
    }

    // Auto-detect delimiter
    const delimiter = detectDelimiter(cleanText);
    console.log('[BulkUpload] Using delimiter:', JSON.stringify(delimiter), 'Lines:', lines.length);

    // Parse header row
    const headers = parseCSVLine(lines[0], delimiter);
    console.log('[BulkUpload] Headers found:', headers.length, headers.slice(0, 5));

    if (headers.length <= 1) {
      throw new Error(`Could not parse columns. Found only ${headers.length} column(s). The file may use an unsupported format.`);
    }

    // Parse data rows
    const rows: Record<string, string>[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i], delimiter);
      // Be more lenient - accept rows that are close to header count
      if (values.length >= headers.length - 2 && values.length <= headers.length + 2) {
        const row: Record<string, string> = {};
        headers.forEach((header, idx) => {
          row[header] = values[idx] || '';
        });
        rows.push(row);
      }
    }

    console.log('[BulkUpload] Rows parsed:', rows.length);
    return { headers, rows };
  }, [detectDelimiter, parseCSVLine]);

  // Auto-map columns based on header names
  const autoMapColumns = useCallback((headers: string[]): ColumnMapping[] => {
    return headers.map(header => {
      const normalizedHeader = header.toLowerCase().trim();

      // Find matching database field
      let matchedField: string | null = null;
      for (const [dbField, hints] of Object.entries(AUTO_MAP_HINTS)) {
        if (hints.some(hint => normalizedHeader.includes(hint) || hint.includes(normalizedHeader))) {
          matchedField = dbField;
          break;
        }
      }

      return {
        csvColumn: header,
        dbField: matchedField,
        sampleValues: [],
      };
    });
  }, []);

  // Handle file upload
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError(null);

    try {
      const text = await selectedFile.text();
      const parsed = parseCSV(text);

      if (parsed.rows.length === 0) {
        throw new Error('No data rows found in file');
      }

      setParsedData(parsed);

      // Auto-map columns and add sample values
      const mappings = autoMapColumns(parsed.headers).map(mapping => ({
        ...mapping,
        sampleValues: parsed.rows.slice(0, 3).map(row => row[mapping.csvColumn] || ''),
      }));

      setColumnMappings(mappings);
      setStep('mapping');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse file');
    }
  }, [parseCSV, autoMapColumns]);

  // Update column mapping
  const updateMapping = useCallback((csvColumn: string, dbField: string | null) => {
    setColumnMappings(prev =>
      prev.map(m => (m.csvColumn === csvColumn ? { ...m, dbField } : m))
    );
  }, []);

  // Group mappings by category
  const groupedFields = useMemo(() => {
    const groups: Record<string, typeof DB_FIELDS> = {};
    DB_FIELDS.forEach(field => {
      if (!groups[field.category]) {
        groups[field.category] = [];
      }
      groups[field.category].push(field);
    });
    return groups;
  }, []);

  // Check if required fields are mapped
  const hasRequiredFields = useMemo(() => {
    const mappedFields = columnMappings.filter(m => m.dbField).map(m => m.dbField);
    return mappedFields.includes('address');
  }, [columnMappings]);

  // Handle import
  const handleImport = useCallback(async () => {
    if (!parsedData || !hasRequiredFields) return;

    setImporting(true);
    setError(null);

    try {
      // Build the import payload
      const mappingObj: Record<string, string> = {};
      columnMappings.forEach(m => {
        if (m.dbField) {
          mappingObj[m.csvColumn] = m.dbField;
        }
      });

      const response = await fetch('/api/master-properties/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source,
          columnMapping: mappingObj,
          rows: parsedData.rows,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Import failed');
      }

      setImportResult({
        success: true,
        imported: result.imported || 0,
        skipped: result.skipped || 0,
        errors: result.errors || 0,
      });
      setStep('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  }, [parsedData, columnMappings, source, hasRequiredFields]);

  // Reset and start over
  const handleReset = useCallback(() => {
    setStep('upload');
    setFile(null);
    setParsedData(null);
    setColumnMappings([]);
    setImportResult(null);
    setError(null);
  }, []);

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-2">
        {(['upload', 'mapping', 'preview', 'complete'] as const).map((s, idx) => (
          <div key={s} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === s
                  ? 'bg-primary-600 text-white'
                  : ['upload', 'mapping', 'preview', 'complete'].indexOf(step) > idx
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              {idx + 1}
            </div>
            {idx < 3 && <div className="w-12 h-0.5 bg-gray-200 mx-1" />}
          </div>
        ))}
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle>Upload Property Data</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Source Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data Source
              </label>
              <select
                value={source}
                onChange={e => setSource(e.target.value as DataSource)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="costar">CoStar</option>
                <option value="crexi">Crexi</option>
                <option value="loopnet">LoopNet</option>
                <option value="mls">MLS</option>
                <option value="public_records">Public Records</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* File Upload */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <input
                type="file"
                accept=".csv,.tsv,.txt"
                onChange={handleFileUpload}
                className="hidden"
                id="csv-upload"
              />
              <label
                htmlFor="csv-upload"
                className="cursor-pointer flex flex-col items-center gap-3"
              >
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <div>
                  <span className="text-primary-600 font-medium">Click to upload</span>
                  <span className="text-gray-500"> or drag and drop</span>
                </div>
                <p className="text-xs text-gray-400">CSV, TSV, or TXT (tab-separated)</p>
              </label>
            </div>

            {file && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Column Mapping */}
      {step === 'mapping' && parsedData && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Map Columns</CardTitle>
                <p className="text-sm text-gray-500 mt-1">
                  {parsedData.rows.length} rows found. Map your columns to database fields.
                </p>
              </div>
              <div className="text-sm text-gray-500">
                {columnMappings.filter(m => m.dbField).length} of {columnMappings.length} mapped
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {columnMappings.map(mapping => (
                <div
                  key={mapping.csvColumn}
                  className="flex items-start gap-4 p-3 bg-gray-50 rounded-lg"
                >
                  {/* CSV Column */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{mapping.csvColumn}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {mapping.sampleValues.filter(Boolean).slice(0, 2).join(' | ') || 'No data'}
                    </p>
                  </div>

                  {/* Arrow */}
                  <div className="text-gray-400 pt-1">→</div>

                  {/* DB Field Selector */}
                  <div className="flex-1">
                    <select
                      value={mapping.dbField || ''}
                      onChange={e => updateMapping(mapping.csvColumn, e.target.value || null)}
                      className={`w-full px-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-primary-500 ${
                        mapping.dbField
                          ? 'border-green-300 bg-green-50'
                          : 'border-gray-300'
                      }`}
                    >
                      <option value="">-- Skip this column --</option>
                      {Object.entries(groupedFields).map(([category, fields]) => (
                        <optgroup key={category} label={category}>
                          {fields.map(field => (
                            <option
                              key={field.field}
                              value={field.field}
                              disabled={columnMappings.some(
                                m => m.dbField === field.field && m.csvColumn !== mapping.csvColumn
                              )}
                            >
                              {field.label}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>

            {!hasRequiredFields && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
                <strong>Required:</strong> Please map the "Property Address" field to continue.
              </div>
            )}

            <div className="mt-6 flex justify-between">
              <Button variant="outline" onClick={handleReset}>
                Start Over
              </Button>
              <Button
                onClick={() => setStep('preview')}
                disabled={!hasRequiredFields}
              >
                Preview Import
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Preview */}
      {step === 'preview' && parsedData && (
        <Card>
          <CardHeader>
            <CardTitle>Preview Import</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg text-center">
                  <p className="text-2xl font-bold text-blue-700">{parsedData.rows.length}</p>
                  <p className="text-sm text-blue-600">Total Rows</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg text-center">
                  <p className="text-2xl font-bold text-green-700">
                    {columnMappings.filter(m => m.dbField).length}
                  </p>
                  <p className="text-sm text-green-600">Fields Mapped</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg text-center">
                  <p className="text-2xl font-bold text-purple-700">{source}</p>
                  <p className="text-sm text-purple-600">Data Source</p>
                </div>
              </div>

              {/* Mapped Fields Preview */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b">
                  <p className="font-medium text-sm">Mapped Fields</p>
                </div>
                <div className="p-4 grid grid-cols-2 gap-2 text-sm">
                  {columnMappings
                    .filter(m => m.dbField)
                    .map(m => (
                      <div key={m.csvColumn} className="flex items-center gap-2">
                        <span className="text-gray-500">{m.csvColumn}</span>
                        <span className="text-gray-400">→</span>
                        <span className="font-medium">{m.dbField}</span>
                      </div>
                    ))}
                </div>
              </div>

              {/* Sample Data Preview */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b">
                  <p className="font-medium text-sm">Sample Data (First 5 rows)</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        {columnMappings
                          .filter(m => m.dbField)
                          .slice(0, 6)
                          .map(m => (
                            <th key={m.csvColumn} className="px-3 py-2 text-left font-medium">
                              {m.dbField}
                            </th>
                          ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {parsedData.rows.slice(0, 5).map((row, idx) => (
                        <tr key={idx}>
                          {columnMappings
                            .filter(m => m.dbField)
                            .slice(0, 6)
                            .map(m => (
                              <td key={m.csvColumn} className="px-3 py-2 truncate max-w-[200px]">
                                {row[m.csvColumn] || '-'}
                              </td>
                            ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep('mapping')}>
                  Back to Mapping
                </Button>
                <Button onClick={handleImport} isLoading={importing}>
                  {importing ? 'Importing...' : `Import ${parsedData.rows.length} Properties`}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Complete */}
      {step === 'complete' && importResult && (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Import Complete!</h3>
            <div className="flex justify-center gap-6 mb-6">
              <div>
                <p className="text-2xl font-bold text-green-600">{importResult.imported}</p>
                <p className="text-sm text-gray-500">Imported</p>
              </div>
              {importResult.skipped > 0 && (
                <div>
                  <p className="text-2xl font-bold text-yellow-600">{importResult.skipped}</p>
                  <p className="text-sm text-gray-500">Skipped</p>
                </div>
              )}
              {importResult.errors > 0 && (
                <div>
                  <p className="text-2xl font-bold text-red-600">{importResult.errors}</p>
                  <p className="text-sm text-gray-500">Errors</p>
                </div>
              )}
            </div>
            <div className="flex justify-center gap-3">
              <Button variant="outline" onClick={handleReset}>
                Import More
              </Button>
              <Button onClick={onComplete}>
                View Properties
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
