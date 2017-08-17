Building a map overlay with a data layer
----------------------------------------

If you have a scalar map data overlay (e.g. slope, temperature, depth or altitude at each location on the map), you can build a false color map layer that will also show the data value numerically below the map when you hover the mouse on the map.

Required data products and conditions
-------------------------------------

- A properly registered GeoTIFF file with the "raw" data (e.g. each pixel is a 32 bit float value representing surface temperature)

- The GeoTIFF file must be in the same projection as the base layer in the xGDS map (usually WGS84 for Earth)

Data Preparation
----------------
1. Run gdalinfo on the data file to get image statistics.  In this example we are using np_weh_adapt.map.npolar.tif as our sample file.

.. code-block:: bash

  gdalinfo -stats np_weh_adapt.map.npolar.tif 
  Band 1 Block=240x8 Type=Float32, ColorInterp=Gray
    Minimum=0.000, Maximum=0.178, Mean=0.067, StdDev=0.025
    Metadata:
      STATISTICS_MAXIMUM=0.1782373636961
      STATISTICS_MEAN=0.067076474228675
      STATISTICS_MINIMUM=0.00028198334621266
      STATISTICS_STDDEV=0.025128417723993

2. Generate a false color image from the data file using the color-relief option of gdaldem:
   Refer to the `gdaldem documentation`_  and examples of `standard colortables`_ from GRASS.

.. code-block:: bash

  gdaldem color-relief ./np_weh_adapt.map.npolar.tif ./BGRYColorTable.txt ./np_weh_adapt.map.npolar.colorized.tif
  0...10...20...30...40...50...60...70...80...90...100 - done.

3. Convert the original floating point TIFF data image to an 8 bit grayscale PNG. For now this is the format that we expect for data values.  You can use Python Imaging Library (Pillow) or MATLAB to do this.  This example uses Python.

.. code-block:: python

  from PIL import Image
  from PIL import ImageMath
  rawMap = Image.open("np_weh_adapt.map.npolar.tif")

  # Compute the scale factor for floating point to 8 bit conversion using the
  # image statistics from gdalinfo (see above)
  scaleFactor = 255.0/0.18
  
  # Build a floating point scaled grayscale image with pixel values from 0-255
  # Note that ImageMath.eval does not accept symbols (like scaleFactor)
  # defined outside its 1st argument, so we recompute the scale factor there.
  wehGrayFloat = ImageMath.eval("(255.0/0.18)*a", a=rawMap)

  # Convert the floating point image to 8 bit grayscale and save it.
  wehGray8Bit = ImageMath.eval("convert(a,'L')", a=wehGrayFloat)
  wehGray8Bit.save("np_weh_adapt.map.npolar.8bit.png")

4. Create a data legend for the map layer.  The legend must be a 40x240 PNG image and needs to be generated manually.  An example file is `legend.png`_ and its photoshop build file is `legend.psd`_.

5. Upload the finished products to xGDS:

  - Follow the instructions here: `Add Map Data Tile`_.
  - In this example, for the jsFunction and jsRawFunction we just need to divide by the *scaleFactor* computed above instead of the value/4.0 from the other example.

.. code-block:: js

  return value/1416.67;
  
.. _gdaldem documentation : http://www.gdal.org/gdaldem.html#gdaldem_color_relief
.. _standard colortables : http://trac.osgeo.org/grass/browser/grass/branches/releasebranch_6_4/lib/gis/colors?order=name
.. _legend.png : https://xgds.org/downloads/legends/weh_legend.png
.. _legend.psd : https://xgds.org/downloads/legends/weh_legend.psd
.. _Add Map Data Tile : /xgds_core/help/xgds_map_server/help/addMapDataTile.rst


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
