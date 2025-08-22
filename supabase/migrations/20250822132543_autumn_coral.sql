/*
  # Spatial Functions for GIS Operations

  1. Spatial Query Functions
    - get_plots_in_bounds: Get plots within a bounding box
    - get_plots_near_point: Get plots within radius of a point
    - calculate_plot_area: Calculate area of a plot
    - get_plot_neighbors: Find neighboring plots

  2. Transaction Functions
    - create_order_transaction: Create order with plot status update
    - approve_order_transaction: Approve order and update plot
    - bulk_import_plots: Import multiple plots from shapefile

  3. Utility Functions
    - convert_geometry_to_geojson: Convert PostGIS to GeoJSON
    - validate_plot_geometry: Validate plot geometry
*/

-- Function to get plots within bounding box
CREATE OR REPLACE FUNCTION get_plots_in_bounds(
  north FLOAT,
  south FLOAT,
  east FLOAT,
  west FLOAT
)
RETURNS TABLE (
  id uuid,
  plot_code text,
  geometry_geojson json,
  centroid_geojson json,
  area_sqm numeric,
  land_use text,
  status plot_status,
  price_usd numeric,
  owner_name text,
  notes text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.plot_code,
    ST_AsGeoJSON(p.geometry)::json as geometry_geojson,
    ST_AsGeoJSON(p.centroid)::json as centroid_geojson,
    p.area_sqm,
    p.land_use,
    p.status,
    p.price_usd,
    p.owner_name,
    p.notes
  FROM plots p
  WHERE ST_Intersects(
    p.geometry,
    ST_MakeEnvelope(west, south, east, north, 4326)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get plots near a point
CREATE OR REPLACE FUNCTION get_plots_near_point(
  lat FLOAT,
  lng FLOAT,
  radius_km FLOAT
)
RETURNS TABLE (
  id uuid,
  plot_code text,
  geometry_geojson json,
  centroid_geojson json,
  area_sqm numeric,
  land_use text,
  status plot_status,
  price_usd numeric,
  distance_km FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.plot_code,
    ST_AsGeoJSON(p.geometry)::json as geometry_geojson,
    ST_AsGeoJSON(p.centroid)::json as centroid_geojson,
    p.area_sqm,
    p.land_use,
    p.status,
    p.price_usd,
    ST_Distance(
      ST_Transform(p.centroid, 3857),
      ST_Transform(ST_SetSRID(ST_MakePoint(lng, lat), 4326), 3857)
    ) / 1000 as distance_km
  FROM plots p
  WHERE ST_DWithin(
    ST_Transform(p.centroid, 3857),
    ST_Transform(ST_SetSRID(ST_MakePoint(lng, lat), 4326), 3857),
    radius_km * 1000
  )
  ORDER BY distance_km;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate plot area
CREATE OR REPLACE FUNCTION calculate_plot_area(plot_id uuid)
RETURNS FLOAT AS $$
DECLARE
  area_sqm FLOAT;
BEGIN
  SELECT ST_Area(ST_Transform(geometry, 3857)) INTO area_sqm
  FROM plots
  WHERE id = plot_id;
  
  RETURN area_sqm;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get neighboring plots
CREATE OR REPLACE FUNCTION get_plot_neighbors(
  plot_id uuid,
  buffer_meters FLOAT DEFAULT 100
)
RETURNS TABLE (
  id uuid,
  plot_code text,
  geometry_geojson json,
  area_sqm numeric,
  land_use text,
  status plot_status,
  distance_m FLOAT
) AS $$
DECLARE
  target_geometry geometry;
BEGIN
  -- Get the target plot geometry
  SELECT geometry INTO target_geometry
  FROM plots
  WHERE plots.id = plot_id;
  
  IF target_geometry IS NULL THEN
    RAISE EXCEPTION 'Plot not found';
  END IF;
  
  RETURN QUERY
  SELECT 
    p.id,
    p.plot_code,
    ST_AsGeoJSON(p.geometry)::json as geometry_geojson,
    p.area_sqm,
    p.land_use,
    p.status,
    ST_Distance(
      ST_Transform(target_geometry, 3857),
      ST_Transform(p.geometry, 3857)
    ) as distance_m
  FROM plots p
  WHERE p.id != plot_id
    AND ST_DWithin(
      ST_Transform(target_geometry, 3857),
      ST_Transform(p.geometry, 3857),
      buffer_meters
    )
  ORDER BY distance_m;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Transaction function to create order
CREATE OR REPLACE FUNCTION create_order_transaction(
  plot_id uuid,
  user_id uuid,
  order_type text DEFAULT 'reservation',
  requested_price numeric DEFAULT NULL,
  purpose text DEFAULT NULL,
  notes text DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  new_order_id uuid;
  plot_status plot_status;
  result json;
BEGIN
  -- Check if plot exists and is available
  SELECT status INTO plot_status
  FROM plots
  WHERE id = plot_id;
  
  IF plot_status IS NULL THEN
    RAISE EXCEPTION 'Plot not found';
  END IF;
  
  IF plot_status != 'available' THEN
    RAISE EXCEPTION 'Plot is not available for ordering';
  END IF;
  
  -- Create the order
  INSERT INTO orders (
    user_id,
    plot_id,
    order_type,
    requested_price,
    purpose,
    notes
  ) VALUES (
    user_id,
    plot_id,
    order_type,
    requested_price,
    purpose,
    notes
  ) RETURNING id INTO new_order_id;
  
  -- Update plot status to pending
  UPDATE plots
  SET status = 'pending'::plot_status,
      updated_at = now()
  WHERE id = plot_id;
  
  -- Return the created order with plot details
  SELECT json_build_object(
    'order_id', o.id,
    'order_number', o.order_number,
    'status', o.status,
    'plot', json_build_object(
      'id', p.id,
      'plot_code', p.plot_code,
      'area_sqm', p.area_sqm,
      'land_use', p.land_use,
      'price_usd', p.price_usd
    ),
    'created_at', o.created_at
  ) INTO result
  FROM orders o
  JOIN plots p ON p.id = o.plot_id
  WHERE o.id = new_order_id;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Transaction function to approve order
CREATE OR REPLACE FUNCTION approve_order_transaction(
  order_id uuid,
  approved_price numeric DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  order_plot_id uuid;
  current_status order_status;
  result json;
BEGIN
  -- Get order details
  SELECT plot_id, status INTO order_plot_id, current_status
  FROM orders
  WHERE id = order_id;
  
  IF order_plot_id IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  
  IF current_status != 'pending' THEN
    RAISE EXCEPTION 'Order is not in pending status';
  END IF;
  
  -- Update order status
  UPDATE orders
  SET 
    status = 'approved'::order_status,
    approved_price = COALESCE(approved_price, requested_price),
    approved_by = auth.uid(),
    approved_at = now(),
    updated_at = now()
  WHERE id = order_id;
  
  -- Update plot status to reserved
  UPDATE plots
  SET 
    status = 'reserved'::plot_status,
    updated_at = now()
  WHERE id = order_plot_id;
  
  -- Return updated order details
  SELECT json_build_object(
    'order_id', o.id,
    'order_number', o.order_number,
    'status', o.status,
    'approved_price', o.approved_price,
    'approved_at', o.approved_at,
    'plot_status', p.status
  ) INTO result
  FROM orders o
  JOIN plots p ON p.id = o.plot_id
  WHERE o.id = order_id;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to bulk import plots
CREATE OR REPLACE FUNCTION bulk_import_plots(
  plots_data json[],
  import_id uuid
)
RETURNS json AS $$
DECLARE
  plot_record json;
  inserted_count integer := 0;
  error_count integer := 0;
  errors text[] := '{}';
BEGIN
  -- Loop through each plot in the array
  FOREACH plot_record IN ARRAY plots_data
  LOOP
    BEGIN
      INSERT INTO plots (
        plot_code,
        geometry,
        area_sqm,
        land_use,
        owner_name,
        price_usd,
        notes,
        import_id
      ) VALUES (
        (plot_record->>'plot_code')::text,
        ST_GeomFromGeoJSON(plot_record->>'geometry'),
        (plot_record->>'area_sqm')::numeric,
        (plot_record->>'land_use')::text,
        (plot_record->>'owner_name')::text,
        (plot_record->>'price_usd')::numeric,
        (plot_record->>'notes')::text,
        import_id
      );
      
      inserted_count := inserted_count + 1;
      
    EXCEPTION WHEN OTHERS THEN
      error_count := error_count + 1;
      errors := array_append(errors, 
        'Plot ' || (plot_record->>'plot_code') || ': ' || SQLERRM
      );
    END;
  END LOOP;
  
  -- Update import record
  UPDATE shapefile_imports
  SET 
    plots_count = inserted_count,
    status = CASE 
      WHEN error_count = 0 THEN 'completed'::import_status
      ELSE 'failed'::import_status
    END,
    error_message = CASE 
      WHEN error_count > 0 THEN array_to_string(errors, '; ')
      ELSE NULL
    END
  WHERE id = import_id;
  
  RETURN json_build_object(
    'imported_count', inserted_count,
    'error_count', error_count,
    'errors', errors
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to convert geometry to GeoJSON
CREATE OR REPLACE FUNCTION convert_geometry_to_geojson(geom geometry)
RETURNS json AS $$
BEGIN
  RETURN ST_AsGeoJSON(geom)::json;
END;
$$ LANGUAGE plpgsql IMMUTABLE STRICT;

-- Function to validate plot geometry
CREATE OR REPLACE FUNCTION validate_plot_geometry(geom geometry)
RETURNS boolean AS $$
BEGIN
  -- Check if geometry is valid
  IF NOT ST_IsValid(geom) THEN
    RETURN false;
  END IF;
  
  -- Check if it's a polygon
  IF ST_GeometryType(geom) != 'ST_Polygon' THEN
    RETURN false;
  END IF;
  
  -- Check if area is reasonable (between 1 sqm and 1 million sqm)
  IF ST_Area(ST_Transform(geom, 3857)) < 1 OR ST_Area(ST_Transform(geom, 3857)) > 1000000 THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql IMMUTABLE STRICT;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_plots_in_bounds TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_plots_near_point TO authenticated, anon;
GRANT EXECUTE ON FUNCTION calculate_plot_area TO authenticated;
GRANT EXECUTE ON FUNCTION get_plot_neighbors TO authenticated;
GRANT EXECUTE ON FUNCTION create_order_transaction TO authenticated;
GRANT EXECUTE ON FUNCTION approve_order_transaction TO authenticated;
GRANT EXECUTE ON FUNCTION bulk_import_plots TO authenticated;
GRANT EXECUTE ON FUNCTION convert_geometry_to_geojson TO authenticated, anon;
GRANT EXECUTE ON FUNCTION validate_plot_geometry TO authenticated;