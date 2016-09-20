
**Map Layers** let you make map features directly in xGDS, namely points, lines and polygons.
The map view is on the left and you can pan and zoom around the map.  The right hand side has tabs 
which provide more detailed editing functionality.

Modes:
------
Buttons in the top left control the modes.

Navigate
	Pan and zoom around the map and explore the Map Layer without modifying it (in the map).

Edit Features
	Modify existing features on the map by clicking and dragging their points around.  
	Note that even if you have just added features you must click Edit Features to modify them.
	
	To delete vertices, press the shift key while you click on it.
	
	To insert a new vertex on a line or polygon,  simply click and drag the blue dot.
	
Add Features
	You must choose the type of feature you will be adding via the radio button; Polygon, Point or Line.  
	Polygon is the default.


Info Tab:
---------
Name
	The name of the Map Layer in the map tree.

Description
	The description of the Map Layer, seen on hovering in the map tree.


Features Tab:
-------------
Features
	The features are listed by name in the leftmost column.  
	
	Edit Feature Properties
		Click on the name of the feature.  Its properties will show in the second column.
		
		Name
			The name of the feature
			
		Description
			Description of the feature; will show on hovering over the feature in the map.
		
		Show Name
			If checked, the name will be shown as a label in the map.

		Style
			Not yet supported

		Coordinates
			Shows all of the coordinates in Lon, Lat format.  You can copy/paste or edit directly into these coordinate fields.

	Delete Feature(s)
		Check the checkbox next to the feature name and click the delete button

Layers Tab:
-----------
Use the layers tab to control the layers just as you do when viewing maps.  
It is not recommended to turn on the Map Layer that you are currently editing.
See `Viewing Maps`_ for more information.
	
Search Tab:
-----------
From the Search tab you can search for and view many other kinds of data in the map.

1. Select the type of data you are searching for in the dropdown and click the **Start** button.
2. A form will be displayed allowing you to filter what you are searching for.  
3. Optionally fill that out and click the **Search** button.
4. Check the **Today** checkbox to limit results to those gathered today.
5. Results if any will be displayed below the form.
6. Select a result by clicking on it to see it in the map.
	
Links Tab:
----------

Click the **Download KML** link to download a KML version of this Map Layer.

Delete Map Layer
----------------

Click the **Delete** button in the upper right.

.. _Viewing Maps : /core/help/xgds_map_server/help/viewMaps.rst/View%20Maps

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
