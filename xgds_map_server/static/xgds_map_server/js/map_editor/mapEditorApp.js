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


(function( xGDS, $, _, Backbone, Marionette ) {

	xGDS.EditorRootView = xGDS.RootView.extend({
		initialize: function() {
			this.listenTo(app.vent, 'mapmode', function(mode) {
				if (mode == 'addFeatures'){
					this.showChildView('editingTools', new app.views.EditingToolsView());
					app.vent.trigger('editingToolsRendered');
				} else {
					this.showChildView('editingTools', new app.views.NavigateView());
				}
			});
			this.listenTo(app.vent, 'mapEditorLayerInitialized', function() {
	        	app.vent.trigger('clearSaveStatus');
	        	if (app.mapLayer.attributes.features.length == 0){
	    		    app.vent.trigger('mapmode', 'addFeatures');
	    		} else {
	    		    app.vent.trigger('mapmode', 'navigate');;
	    		}
        	});
		},
		regions: {
			mapRegion: '#map',
			toolbar: '#toolbar',
			tabs: '#tabs',
			editingTools: '#editingTools'
		},
		onRender: function() {
			app.map = new app.views.OLEditMapView();
			this.showChildView('mapRegion', app.map);
			this.showChildView('toolbar', new app.views.ToolbarView());
			this.showChildView('tabs', new app.views.TabNavView());
		}
	});

	xGDS.EditorApplication = xGDS.Application.extend( {
		mapBottomPadding: 150,
		expandableTab: 'features',
		dirty: false,
		getRootView: function() {
			return new xGDS.EditorRootView();
		},
		onStart: function() {
        	xGDS.Application.prototype.onStart.call(this);
        	this.parseJSON();
        	this.listenTo(app.vent, 'deleteFeature', function(feature){
            	this.util.deleteFeature(feature);
            });
        },
        State: {
        	featureSelected: undefined,
            metaExpanded: undefined,
            mouseDownLocation: undefined,
            pageInnerWidth: undefined,
            tabsLeftMargin: undefined,
            pageContainer: undefined,
            tabsContainer: undefined,
            mapResized: false,
            mapHeightSet: false,
            siteFrameMode: false,
            tree: undefined,
            treeData: null,
            disableAddFeature: false,
            popupsEnabled: true
        },
       /*Actions: xGDS.Actions,
       getSerializableObject: function() {
			if (!_.isUndefined(this.mapLayer)) {
				return this.mapLayer;
			} else {
				return '';
			}
		},*/
		updateSerializableObject: function(sObject){
			this.updateMapLayer(sObject);
		},
        parseJSON: function() {
        	// create the map layer from map layer obj passed in from server as json
            app.mapLayer = new app.models.MapLayer(app.options.mapLayerDict);

         	// create backbone feature objects already existing in mapLayer's attributes
    		$.each(app.mapLayer.attributes.jsonFeatures.features, function(index, featureJson) {
    			var featureObj = new app.models.Feature(featureJson);
    			featureObj.json = featureJson;
    			featureObj.set('mapLayer', app.mapLayer);  // set up the relationship.
    			featureObj.set('mapLayerName', app.mapLayer.get('name'));
    			featureObj.set('uuid', featureJson.uuid);
    		});
    		this.vent.trigger('onLayerLoaded');
        },

        util: {
	        deleteFeature: function(feature){
	            feature.destroy({
				data: { 'uuid': feature.uuid },
				wait: true,
				success: function(model, response) {
				    if(!_.isUndefined(feature.collection)) {
		    			feature.collection.remove(feature);
		    		    }
				    app.vent.trigger('deleteFeatureSuccess', feature);
				}, 
				error: function() {
					console.log("Error in deleting a feature");
				}
			});
	        },
	        getFeatureWithName: function(name) {
	          var features = app.mapLayer.get('feature').toArray();
	          var foundFeature = undefined;
	          for (var i=0; i< features.length; i++){
	              var feature = features[i];
	              if (feature.get('name') == name){
	        	  foundFeature = feature;
	        	  break;
	              }
	          }
	          return foundFeature;
	        },
	        generateFeatureName: function(type) {
	        	// create a name based type and an index
	        	var key = type.substring(0,4);
	        	if (type === 'Point'){
	        	    key = key + 't';
	        	}
	        	var suggestion = key + app.util.pad(this.getNextIndex(type), 3, 0);
	        	while (this.getFeatureWithName(suggestion) != undefined){
	        	    suggestion = key + app.util.pad(this.getNextIndex(type), 3, 0);
	        	}
	        	return suggestion;
	                    
	        },
	        getNextIndex: function(type){
	            if (!app.indicesInitialized){
	                this.initializeIndices();
	            }
	            app.featureIndex[type] = app.featureIndex[type] + 1;
	            return app.featureIndex[type];
	        },
	        initializeIndices: function() {
	            var index = 0;
	            var features = app.mapLayer.get('feature').toArray();
	            app.featureIndex = [];
	            app.featureIndex['Polygon'] = 0;
	            app.featureIndex['Point'] = 0;
	            app.featureIndex['LineString'] = 0;
	            app.featureIndex['GroundOverlay'] = 0;
	            _.each(features, function(feature) {
	        	if (feature != undefined){
	                    var type = feature.type;
	                    if (_.isUndefined(app.featureIndex[type])){
	                        app.featureIndex[type] = 0;
	                    } else {
	                        app.featureIndex[type] = app.featureIndex[type] + 1;
	                    }
	        	}
	            }); 
	            app.indicesInitialized = true;
	        },
	        getRandomInt: function() {
	        	// returns random integer btw 0 and 100
	        	return Math.floor((Math.random() * 100) + 1);
	        },
	        pad: function(n, width, z) { 
	        	//pads a number 'width' times with 'z'. i.e. pad(1,4,0) = 0001 
	        	z = z || '0';
	        	n = n + '';
	        	return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
	        },
	        
	        getFeatureCoordinates: function(type, feature) {
	        	if (type == 'Point') {
	        		return feature.get('point');
	        	} else if (type == 'Polygon') {
	        		return feature.get('polygon');
	        	} else if (type == 'LineString') {
	        		return feature.get('lineString');
	        	} 
	        },
	        
	        updateFeatureCoordinate: function(type, feature, newX, newY, index) {
	        	/*
	        	 * newCoords: updated (x,y) in lon lat
	        	 * index: index for vertices if is a linestring or a polygon
	        	 */
	        	if (type == 'Point') {
	        		feature.set('point', [newX, newY]);
	        	} else if (type == 'Polygon') {
	        		var polygon = feature.get('polygon');
	        		polygon[index] = [newX, newY];
	        		//note: ol polygon coords list both start and end point (which are the same). 
	        		// so when start pt changes, update the end point.
	        		if (index == 0) {
	        			polygon[-1] = [newX, newY];
	        		}
	        		feature.set('polygon', polygon);
	        	} else if (type == 'LineString') {
	        		var lineString = feature.get('lineString');
	        		lineString[index] = [newX, newY];
	        		feature.set('lineString', lineString);
	        	} 
	        },
	        
	        transformAndSetCoordinates: function(type, feature, coordinates) {
	        	// transform user drawn coordinates from spherical mercator to lon lat
	        	var tCoords = null;
	        	if (type == "Point") {
	    			feature.set("point", inverseTransform(coordinates));
	    		} else if (type == "Polygon") {
	    			feature.set('polygon', inverseList(coordinates));
	    		} else if (type == "LineString") {
	                feature.set('lineString', inverseList(coordinates));
	    		} else if (type == "GroundOverlay") {
	                feature.set('polygon', inverseList(coordinates));
	            }
	    	}
        }
	        
    });

    xGDS.Factory = {
			construct: function(options){
				return new xGDS.EditorApplication(options);
			}
	};


}( window.xGDS = window.xGDS || {}, jQuery, _, Backbone, Marionette ));