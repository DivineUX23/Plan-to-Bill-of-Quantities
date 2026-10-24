export interface Point {
  0: number;
  1: number;
}

export interface Wall {
  id: string;
  kind: 'external' | 'internal';
  points: [number, number][];
  closed?: boolean;
  ref?: 'centre' | 'outer' | 'inner';
  thickness?: number;
  height?: number;
}

export interface Room {
  id: string;
  name: string;
  points: [number, number][];
  floor_finish?: string;
  wall_finish?: string;
  ceiling_finish?: string;
  wall_tile_height?: number;
  height?: number;
  skirting?: boolean;
}

export interface Opening {
  id: string;
  type: string;
  x: number;
  y: number;
  wall_id?: string;
  angle?: number;
  count: number;
}

export interface SheetGeometry {
  walls: Wall[];
  rooms: Room[];
  openings: Opening[];
}

export interface CalibrationData {
  p1: [number, number];
  p2: [number, number];
  pixel_distance: number;
  real_length_m: number;
  label: string;
  source?: string;
}

export interface SheetSummary {
  id: string;
  name: string;
  page_index: number;
  position: number;
  width_px: number;
  height_px: number;
  render_dpi: number | null;
  is_vector: boolean;
  scale_m_per_px: number | null;
  include: boolean;
  has_substructure: boolean;
  has_roof: boolean;
  updated_at: string;
}

export interface SheetOut extends SheetSummary {
  project_id: string;
  drawing_id: string;
  calibration: CalibrationData | null;
  geometry: SheetGeometry;
}

export interface DrawingOut {
  id: string;
  filename: string;
  page_count: number;
  created_at: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  client: string | null;
  location: string | null;
  created_at: string;
  updated_at: string;
  sheet_count: number;
  thumbnail_sheet_id: string | null;
}

export interface OpeningTypeSpec {
  mark: string;
  kind: 'door' | 'window';
  width: number;
  height: number;
  description: string;
}

export interface ProjectSpecs {
  external_wall_thickness: number;
  internal_wall_thickness: number;
  wall_height: number;
  room_height: number;
  min_void_deduction: number;
  lintel_mode: 'individual' | 'continuous' | 'none';
  lintel_depth: number;
  lintel_bearing: number;
  lintel_rebar_kg_per_m3: number;
  foundation_internal_walls: boolean;
  trench_width: number;
  trench_depth: number;
  footing_width: number;
  footing_thickness: number;
  blinding_thickness: number;
  substructure_wall_thickness: number;
  dpc_height: number;
  oversite_thickness: number;
  hardcore_thickness: number;
  site_clearance_margin: number;
  topsoil_depth: number;
  slab_mesh: boolean;
  roof_type: 'hip' | 'gable' | 'flat';
  roof_pitch_deg: number;
  roof_overhang: number;
  opening_types: OpeningTypeSpec[];
  finish_options: {
    floor: string[];
    wall: string[];
    ceiling: string[];
  };
  default_floor_finish: string;
  default_wall_finish: string;
  default_ceiling_finish: string;
  skirting_height: number;
  external_finish: string;
  external_trace_reference: 'outer' | 'centre';
}

export interface ProjectOut {
  id: string;
  name: string;
  client: string | null;
  location: string | null;
  specs: ProjectSpecs;
  created_at: string;
  updated_at: string;
  drawings: DrawingOut[];
  sheets: SheetSummary[];
}

export interface TakeoffItem {
  key: string;
  description: string;
  unit: string;
  quantity: number;
  trace: string[];
}

export interface TakeoffGroup {
  key: string;
  title: string;
  items: TakeoffItem[];
}

export interface Takeoff {
  project_id: string;
  groups: TakeoffGroup[];
  summary: Record<string, number>;
  warnings: string[];
  sheets: string[];
}

export interface DetectResult {
  method: string;
  geometry: SheetGeometry;
  suggested_scale_m_per_px: number | null;
  notes: string[];
}

export interface BoqItem {
  id: string;
  item_ref: string;
  code: string;
  element: string;
  description: string;
  unit: string;
  quantity: number;
  rate: number;
  amount: number;
  trace: string[];
  is_provisional: boolean;
}

export interface BoqBill {
  id: string;
  bill_number: number;
  title: string;
  work_section: string;
  preamble?: string | null;
  items: BoqItem[];
  subtotal: number;
}

export interface BoqSummary {
  bill_totals: Record<string, number>;
  subtotal_1: number;
  contingency_rate: number;
  contingency_amount: number;
  subtotal_2: number;
  overhead_profit_rate: number;
  overhead_profit_amount: number;
  vat_rate: number;
  vat_amount: number;
  grand_total: number;
}

export interface BoqOut {
  id: string;
  project_id: string;
  title: string;
  currency: string;
  currency_symbol: string;
  rounding_rule: 'besmm4_whole' | 'two_dp';
  bills: BoqBill[];
  summary: BoqSummary;
  created_at: string;
  updated_at: string;
}

export interface BoqUpdate {
  title?: string;
  currency?: string;
  currency_symbol?: string;
  rounding_rule?: string;
  bills?: BoqBill[];
  summary?: BoqSummary;
}

export interface BoqGenerateRequest {
  rounding_rule?: 'besmm4_whole' | 'two_dp';
  currency?: string;
  populate_default_rates?: boolean;
}

export interface RawTakeoffRow {
  id: string;
  timesing: string;
  dim1: number | null;
  dim2: number | null;
  dim3: number | null;
  squaring: number;
  description: string;
  unit: string;
  bill_number: number;
  work_section: string;
}

export interface RawTakeoffOut {
  id: string;
  project_id: string;
  title: string;
  rows: RawTakeoffRow[];
  updated_at: string;
}

export interface RawTakeoffUpdate {
  title?: string;
  rows: RawTakeoffRow[];
}

export interface Besmm4Reference {
  code: string;
  work_section_number: number;
  work_section_code: string;
  section_title: string;
  page: number;
  tabulated_page: number;
  coding_rules_page: number;
  standard: string;
  clause_ref: string;
  divisions: {
    part: string;
    work_section: string;
    col1: string;
    col2: string;
    col3: string;
  };
  measurement_rules: string[];
  pdf_url: string;
}

