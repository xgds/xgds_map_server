// __BEGIN_LICENSE__
// Copyright (c) 2015, United States Government, as represented by the 
// Administrator of the National Aeronautics and Space Administration. 
// All rights reserved.
//
// The xGDS platform is licensed under the Apache License, Version 2.0 
// (the "License"); you may not use this file except in compliance with the License. 
// You may obtain a copy of the License at 
// http://www.apache.org/licenses/LICENSE-2.0.
//
// Unless required by applicable law or agreed to in writing, software distributed 
// under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR 
// CONDITIONS OF ANY KIND, either express or implied. See the License for the 
// specific language governing permissions and limitations under the License.
// __END_LICENSE__

var xgds_map = xgds_map || {};

xgds_map.getCoords = function(coords){
    return xgds_map.coordinator.printCoords(coords);
}


xgds_map.mousePositionControl = new ol.control.MousePosition({
    coordinateFormat:  xgds_map.getCoords,
//    coordinateFormat: ol.coordinate.createStringXY(4),
    projection: LONG_LAT,
    // comment the following two lines to have the mouse position
    // be placed within the map.
    className: 'custom-mouse-position',
    target: document.getElementById('postmap'),
    undefinedHTML: 'Unknown Position'
  });

xgds_map.coordinator = {
		
    printCoords: function(coord) {
        var result = transform(coord);
        return "lat: " + coord[1] + " lon: " + coord[0]; // + " x: " + result[1] + " y: " + result[0];
    },

    init: function() {
        app.map.map.addControl(xgds_map.mousePositionControl);
    },
    

};
