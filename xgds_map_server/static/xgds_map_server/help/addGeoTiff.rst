
**GeoTiff Layers** let you import GeoTiff files as layers in the map tree.

GeoTiff files are rendered with the support of a service running behind xGDS.  For that reason, if you want to delete or replace a GeoTiff file,
we recommend you upload a file with a different name.

Options:
--------

Name
	The name of the GeoTiff in the map tree.

Description
	The description of the GeoTiff, seen on hovering in the map tree.

Region
	The region on the map which contains this GeoTiff.

Locked
	If nobody should be able to modify this GeoTiff, check locked.

Visible
	If this GeoTiff should be turned on (visible) by default, check visible.

Transparency
	Percentage transparency by default; 100% is fully transparent.  You can control
	transparency later while viewing; this setting is a default.

Folder
	The containing Folder in the map tree.

GeoTiff File
	The actual GeoTiff file to upload.  It should contain one band of data.  When the file has finished uploading,
	you will see the name of the file to the right of this row, and at that point you may click the *Create* once all fields are filled in.

Minimum Value
    The minimum value found in the file, for rendering the colors.  You can find this with gdalinfo.

Maximum Value
    The maximum value found in the file, for rendering the colors.  You can find this with gdalinfo.

Minimum Color
    The color to assign to minimum values when building the color ramp

Maximum Color
    The color to assign to maximum values when building the color ramp

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
