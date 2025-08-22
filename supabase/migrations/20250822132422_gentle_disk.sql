/*
  # GIS-Enabled Land Plot Ordering System Database Schema

  1. New Tables
    - `plots` - Spatial data for land plots with PostGIS geometry
    - `orders` - Plot reservation and ordering system
    - `shapefile_imports` - Track shapefile upload history
    - `plot_attributes` - Extended attributes from shapefile DBF files
    - `spatial_layers` - Manage different spatial datasets

  2. Security
    - Enable RLS on all tables
    - Add policies for user and admin access
    - Spatial indexing for performance

  3. Extensions
    - Enable PostGIS for spatial operations
    - Add spatial indexes and constraints
*/

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- Create enum types
CREATE TYPE plot_status AS ENUM ('available', 'reserved', 'sold', 'pending');
CREATE TYPE order_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
CREATE TYPE user_role AS ENUM ('admin', 'user');
CREATE TYPE import_status AS ENUM ('processing', 'completed', 'failed');

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  role user_role DEFAULT 'user',
  phone text,
  address text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Shapefile imports tracking
CREATE TABLE IF NOT EXISTS shapefile_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text NOT NULL,
  original_filename text NOT NULL,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  upload_date timestamptz DEFAULT now(),
  status import_status DEFAULT 'processing',
  plots_count integer DEFAULT 0,
  file_size bigint,
  projection text,
  bounds geometry(Polygon, 4326),
  metadata jsonb DEFAULT '{}',
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- Main plots table with spatial geometry
CREATE TABLE IF NOT EXISTS plots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plot_code text UNIQUE NOT NULL,
  geometry geometry(Polygon, 4326) NOT NULL,
  centroid geometry(Point, 4326),
  area_sqm numeric NOT NULL,
  perimeter_m numeric,
  land_use text,
  status plot_status DEFAULT 'available',
  owner_name text,
  title_deed text,
  zone_classification text,
  soil_type text,
  elevation numeric,
  slope_percentage numeric,
  access_road boolean DEFAULT false,
  utilities jsonb DEFAULT '{}', -- water, electricity, internet, etc.
  price_usd numeric,
  price_per_sqm numeric,
  valuation_date date,
  notes text,
  import_id uuid REFERENCES shapefile_imports(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Plot attributes from shapefile DBF
CREATE TABLE IF NOT EXISTS plot_attributes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plot_id uuid REFERENCES plots(id) ON DELETE CASCADE,
  attribute_name text NOT NULL,
  attribute_value text,
  data_type text, -- string, number, date, boolean
  source_column text, -- original DBF column name
  created_at timestamptz DEFAULT now()
);

-- Orders/Reservations
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text UNIQUE NOT NULL DEFAULT 'ORD-' || extract(year from now()) || '-' || lpad(nextval('order_sequence')::text, 6, '0'),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  plot_id uuid REFERENCES plots(id) ON DELETE CASCADE,
  status order_status DEFAULT 'pending',
  order_type text DEFAULT 'reservation', -- reservation, purchase, lease
  requested_price numeric,
  approved_price numeric,
  payment_terms text,
  payment_status text DEFAULT 'pending',
  payment_due_date date,
  contract_start_date date,
  contract_end_date date,
  purpose text, -- intended use
  notes text,
  admin_notes text,
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  rejected_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create sequence for order numbers
CREATE SEQUENCE IF NOT EXISTS order_sequence START 1;

-- Spatial layers for different datasets
CREATE TABLE IF NOT EXISTS spatial_layers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  layer_type text, -- plots, boundaries, infrastructure, etc.
  style_config jsonb DEFAULT '{}',
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create spatial indexes for performance
CREATE INDEX IF NOT EXISTS idx_plots_geometry ON plots USING GIST (geometry);
CREATE INDEX IF NOT EXISTS idx_plots_centroid ON plots USING GIST (centroid);
CREATE INDEX IF NOT EXISTS idx_plots_status ON plots (status);
CREATE INDEX IF NOT EXISTS idx_plots_land_use ON plots (land_use);
CREATE INDEX IF NOT EXISTS idx_plots_price ON plots (price_usd);
CREATE INDEX IF NOT EXISTS idx_shapefile_imports_bounds ON shapefile_imports USING GIST (bounds);

-- Create regular indexes
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders (user_id);
CREATE INDEX IF NOT EXISTS idx_orders_plot_id ON orders (plot_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at);
CREATE INDEX IF NOT EXISTS idx_plot_attributes_plot_id ON plot_attributes (plot_id);

-- Enable Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE shapefile_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE plots ENABLE ROW LEVEL SECURITY;
ALTER TABLE plot_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE spatial_layers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_profiles
CREATE POLICY "Users can read own profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins can read all profiles"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for plots (public read, admin write)
CREATE POLICY "Anyone can read plots"
  ON plots
  FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Admins can manage plots"
  ON plots
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for plot_attributes
CREATE POLICY "Anyone can read plot attributes"
  ON plot_attributes
  FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Admins can manage plot attributes"
  ON plot_attributes
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for orders
CREATE POLICY "Users can read own orders"
  ON orders
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create orders"
  ON orders
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own pending orders"
  ON orders
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND status = 'pending')
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can manage all orders"
  ON orders
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for shapefile_imports
CREATE POLICY "Admins can manage shapefile imports"
  ON shapefile_imports
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for spatial_layers
CREATE POLICY "Anyone can read spatial layers"
  ON spatial_layers
  FOR SELECT
  TO authenticated, anon
  USING (is_active = true);

CREATE POLICY "Admins can manage spatial layers"
  ON spatial_layers
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Functions for automatic updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_user_profiles_updated_at 
  BEFORE UPDATE ON user_profiles 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_plots_updated_at 
  BEFORE UPDATE ON plots 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at 
  BEFORE UPDATE ON orders 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate plot centroid
CREATE OR REPLACE FUNCTION calculate_plot_centroid()
RETURNS TRIGGER AS $$
BEGIN
  NEW.centroid = ST_Centroid(NEW.geometry);
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-calculate centroid
CREATE TRIGGER calculate_plot_centroid_trigger
  BEFORE INSERT OR UPDATE ON plots
  FOR EACH ROW EXECUTE FUNCTION calculate_plot_centroid();

-- Function to update plot status when order is approved
CREATE OR REPLACE FUNCTION update_plot_status_on_order_approval()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    UPDATE plots 
    SET status = 'reserved'::plot_status 
    WHERE id = NEW.plot_id;
  ELSIF NEW.status IN ('rejected', 'cancelled') AND OLD.status = 'approved' THEN
    UPDATE plots 
    SET status = 'available'::plot_status 
    WHERE id = NEW.plot_id;
  END IF;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for plot status updates
CREATE TRIGGER update_plot_status_trigger
  AFTER UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_plot_status_on_order_approval();

-- Insert default spatial layer
INSERT INTO spatial_layers (name, description, layer_type, style_config) 
VALUES (
  'Land Plots', 
  'Main land plot boundaries', 
  'plots',
  '{"fillColor": "#3b82f6", "fillOpacity": 0.3, "color": "#1d4ed8", "weight": 2}'
) ON CONFLICT DO NOTHING;

-- Create view for plot statistics
CREATE OR REPLACE VIEW plot_statistics AS
SELECT 
  COUNT(*) as total_plots,
  COUNT(*) FILTER (WHERE status = 'available') as available_plots,
  COUNT(*) FILTER (WHERE status = 'reserved') as reserved_plots,
  COUNT(*) FILTER (WHERE status = 'sold') as sold_plots,
  SUM(area_sqm) as total_area_sqm,
  AVG(price_usd) as avg_price_usd,
  MIN(price_usd) as min_price_usd,
  MAX(price_usd) as max_price_usd
FROM plots;

-- Create view for order statistics
CREATE OR REPLACE VIEW order_statistics AS
SELECT 
  COUNT(*) as total_orders,
  COUNT(*) FILTER (WHERE status = 'pending') as pending_orders,
  COUNT(*) FILTER (WHERE status = 'approved') as approved_orders,
  COUNT(*) FILTER (WHERE status = 'rejected') as rejected_orders,
  AVG(requested_price) as avg_requested_price,
  SUM(approved_price) as total_approved_value
FROM orders;