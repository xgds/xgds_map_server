
**Map Tiles** are geoTiff tiled data.  They can be turned on and off in the xGDS maps.

Input file:
------------

GeoTiff Source File
	A registered GeoTiff which will be tiled and rendered
	in the map. Note that once this is imported and tiled, it cannot be modified.
 	Make sure it is in the correct map projection.

	If you are starting from a floating point TIFF file with data
	values, **you** need to generate a false color version of the
	the TIFF image to display in the map.

	See `Data Layers`_ for more information.

Other options:
--------------

Name
	The name of the Map Tile in the map tree.

Description
	The description of the Map Tile, seen on hovering in the map tree.

Locked
	If nobody should be able to modify this Map Tile, check locked.

Visible
	If this Map Tile should be turned on (visible) by default, check visible.

Transparency
	Percentage transparency by default; 100% is fully transparent.  You can control 
	transparency later while viewing; this setting is a default.

Resampling Method
	This is used when tiling the GeoTiff.  Typically you can leave it at the default.
 
.. _Data Layers : /core/help/xgds_map_server/help/addDataLayer.rst

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
