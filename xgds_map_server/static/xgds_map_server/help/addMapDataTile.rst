
**Map Data Tiles** are geoTiff tiled data that also have png data source along
with optional legend files.  They can be turned on and off in the xGDS maps,
and will show data values below the map when you move your mouse in the map.

Input files:
------------

GeoTiff Source File
	A registered GeoTiff which will be tiled and rendered
	in the map. Note that once this is imported and tiled, it cannot be modified.
 	Make sure it is in the correct map projection.

Data File
	A png data file providing the pixel by pixel values.

Legend File
	An image for the map legend, suggest roughly 240 pixel tall x 40-50 pixel wide.

	If you are starting from a floating point TIFF file with data
	values, **you** need to generate a false color version of the
	the TIFF image to display in the map in addition to the PNG with
	the data values.

	See `Data Layers`_ for more information.

Other options:
--------------

Name
	The name of the Map Data Tile in the map tree.

Description
	The description of the Map Data Tile, seen on hovering in the map tree.

Locked
	If nobody should be able to modify this Map Data Tile, check locked.

Visible
	If this Map Data Tile should be turned on (visible) by default, check visible.

Transparent
	Percentage transparency by default; 100% is fully transparent.  You can control 
	transparency later while viewing; this setting is a default.

Legend Default Visible
	Whether the legend should be turned on by default when the layer is turned on.
	
Value Label
	The label to the left of the value under the map, i.e. Slope.

Units Label
	The label for units, shown to ther right of the value under the map, i.e. m.

jsFunction
	Javascript function to modify the exact value retrieved from the png and printed below the map.  
	For example, if the values in the png file vary between 1 and 100 but you need 
	to divide it by 4, include some javascript, where value is the exact
	incoming value from the png:
	
	.. code:: javascript

	  return (value/4.0).toFixed(2);

jsRawFunction
	Javascript function to modify the exact value retrieved from the png and used as a raw value.  
	For example, if the values in the png file vary between 1 and 100 but you need 
	to divide it by 4, include some javascript, where value is the exact
	incoming value from the png:
	
	.. code:: javascript

	  return value/4.0;
	  

Resampling Method
	This is used when tiling the GeoTiff.  Typically you can leave it at the default.
	"Lanczos" will smooth the image tiles when they are resampled. "Nearest Neighbor" will not.

 
.. _Data Layers : /xgds_core/help/xgds_map_server/help/addDataLayer.rst/Data%20Layers

.. o __BEGIN_LICENSE__
.. o  Copyright (c) 2015, United States Government, as represented by the
.. o  Administrator of the National Aeronautics and Space Administration.
.. o  All rights reserved.
.. o 
.. o  The xGDS platform is licensed under the Apache License, Version 2.0
.. o  (the "License"); you may not use this file except in compliance with the License.
.. o  You may obtain a copy of the License at
.. o  http://www.apache.org/licenses/LICENSE-2.0.
.. o 
.. o  Unless required by applicable law or agreed to in writing, software distributed
.. o  under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
.. o  CONDITIONS OF ANY KIND, either express or implied. See the License for the
.. o  specific language governing permissions and limitations under the License.
.. o __END_LICENSE__
