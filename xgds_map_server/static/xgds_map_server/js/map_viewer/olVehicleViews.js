//__BEGIN_LICENSE__
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
//__END_LICENSE__


$(function() {
    app.views = app.views || {};
    
    app.views.OLVehicleView = app.views.VectorView.extend({
    	initialize: function(options) {
            this.options = options || {};
            if (!options.featureJson) {
                throw 'Missing a required option!';
            }
            this.featureJson = this.options.featureJson; 
            this.constructContent();
            this.render();
            this.listenTo(app.vent, 'vehicle:change', function(params) {this.updateVehicle(params)});
            this.listenTo(app.vent, this.options.featureJson.vehicle + ':change', function(params) {this.updateVehicle(params)});
        },
        constructContent: function() {
            this.feature = this.constructFeature();
            if (!_.isNull(this.feature)){
            	this.olSource = new ol.source.Vector({features: [this.feature]});
                this.vectorLayer = new ol.layer.Vector({
                    name: this.featureJson.name,
                    source: this.olSource,
                    zIndex: 3,
                    style: this.getStyles()
                });
                this.vectorLayer.setZIndex(1000);
            }
            // set rotation
            if (!_.isNull(this.featureJson.startPoint.rotation)) {
                this.setRotation(this.featureJson.startPoint.rotation);
            }
            app.vent.trigger('vehicle:constructed', this.vectorLayer);
        },
    	constructFeature: function() {
            if (this.olFeature == undefined){
            	this.geometry = new ol.geom.Point(this.featureJson.startPoint.location);
	        	this.olFeature = new ol.Feature({
	        	    name: this.featureJson.name,
	        	    geometry: this.geometry
	        	});
            }
            return this.olFeature;
        },
        getStyles: function() {
    	    if (this.featureJson.vehicle in olStyles.styles){
    	        return [olStyles.styles[this.featureJson.vehicle]];
            } else if ('icon_url' in this.featureJson) {
    	        // build the new style
                var newStyleDict = {'src':this.featureJson.icon_url,
                                'scale':this.featureJson.icon_scale};
                if (!_.isEmpty(this.featureJson.icon_color)){
                    newStyleDict['color'] = this.featureJson.icon_color;
                }
                var newStyle = new ol.style.Style({
                    image: new ol.style.Icon(newStyleDict)
                });
                olStyles.styles[this.featureJson.vehicle] = newStyle;
                return [newStyle];
            }
        	return [olStyles.styles['vehicle']];
        },
        updateVehicle: function(params) {
        	if (params == null){
        		return;
        	}
        	// params is a map with location and rotation
        	this.setLocation(params.location);
        	if (params.rotation != null){
        		this.setRotation(params.rotation);
        	}
        },
        setLocation: function(newLocation) {
        	// must be in site frame coordinates
        	this.geometry.setCoordinates(newLocation);
        	this.olFeature.changed();
        },
        setRotation: function(newRotation) {
        	// in radians
        	var image = this.vectorLayer.getStyle()[0].getImage();
        	if (HEADING_UNITS === 'degrees') {
                newRotation = newRotation * (Math.PI / 180);
            }
        	image.setRotation(newRotation);
        	this.vectorLayer.changed();
        },
        render: function() {
        }
        });

});