// __BEGIN_LICENSE__
//Copyright (c) 2015, United States Government, as represented by the 
//Administrator of the National Aeronautics and Space Administration. 
//All rights reserved.
//
//The xGDS platform is licensed under the Apache License, Version 2.0 
//(the "License"); you may not use this file except in compliance with the License. 
//You may obtain a copy of the License at 
//http://www.apache.org/licenses/LICENSE-2.0.
//
//Unless required by applicable law or agreed to in writing, software distributed 
//under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR 
//CONDITIONS OF ANY KIND, either express or implied. See the License for the 
//specific language governing permissions and limitations under the License.
// __END_LICENSE__

$(function() {
    app.views = app.views || {};

    app.views.OLEditMapView =  app.views.OLMapView.extend({
        initialize: function(options) {
            app.views.OLMapView.prototype.initialize.call(this);
            // set up tabs
            app.State.tabsContainer = $('#tabs');
            app.State.tabsLeftMargin = parseFloat(app.State.tabsContainer.css('margin-left'));
            app.vent.on('layers:loaded', this.initializeMapEditor);
            app.vent.on('layers:loaded', this.createMapEditorView);
        },
        buildLayersForMap: function() {
            app.views.OLMapView.prototype.buildLayersForMap.call(this);
            this.mapEditorGroup = new ol.layer.Group();
            this.layersForMap.push(this.mapEditorGroup);
        },
        createMapEditorView: function() {
            var mapEditorView = new app.views.MapEditorView({
                mapLayerJson: {},
                mapLayerGroup: this.mapEditorGroup,
                map: this.map
            });
            return mapEditorView;
        }, 
        updateBbox: function() {
            app.views.OLMapView.prototype.updateBbox.call(this);
        },
        render: function() {
            app.views.OLMapView.prototype.render.call(this);
            this.createMapEditorView();
            this.updateBbox();
        }
    });
    
    /*
     * Views for MapEditor
     * 
     */
    app.views.MapEditorView = app.views.MapLayerView.extend({
    	initialize: function(options) {
    		app.views.MapLayerView.prototype.initialize.call(this, options); // call super
    		app.vent.on('mapmode', this.setMode, this);
    		app.vent.trigger('mapmode', 'navigate');
    		this.map = this.options.map;
    		app.vent.on('editingToolsRendered', function(){
      			//set up typeSelect for addFeaturesMode
//        		this.typeSelect = document.getElementById('type');
        		var _this = this;
        		var theEl = $('input:radio[name=addType]');
        		var selectedEl = $('input:radio[name=addType]:checked');
        		_this.typeSelect = selectedEl.val();
                $('input:radio[name=addType]').change(function() {
    				if (_this.featureAdder) {
    					_this.map.removeInteraction(_this.featureAdder);
    				} 
    				_this.typeSelect = $('input:radio[name=addType]:checked').val();
    				_this.addDrawInteraction(_this.typeSelect);
    			});
      		}, this);
      		app.vent.on('deleteSelectedFeatures', this.deleteFeatureFromOverlay, this);
      		app.vent.on('updateFeaturePosition', this.updateFeaturePosition, this);
    	},
    	createFeatureOverlay: function() {
            this.featureOverlay = new ol.FeatureOverlay({
	      		  style: app.util.getDefaultStyle()
	      		});
            this.featureOverlay.setMap(this.options.map);
    	},
    	initializeFeaturesJson: function() {
            this.trigger('readyToDraw');
        },
        constructFeatures: function() {
            if (_.isUndefined(this.layerGroup)){
                this.layerGroup = new ol.layer.Group({name: app.mapLayer.get('name')});
            };
            var mlview = this;
            var testFeatureObjects = app.mapLayer.get('feature');
            _.each(testFeatureObjects.models, function(featureObj){
            	mlview.createFeature(featureObj);
            });
        },
        createFeature: function(featureObj){
            var newFeatureView;
            var featureJson = featureObj.json;
            switch (featureJson['type']){
            case 'GroundOverlay':
                newFeatureView = new app.views.GroundOverlayEditView({
                    layerGroup: this.layerGroup,
                    featureJson: featureJson
                });
                this.drawBelow = true;
                break;
            case 'Polygon':
                newFeatureView = new app.views.PolygonEditView({
                    layerGroup: this.layerGroup,
                    featureJson: featureJson
                });
                break;
            case 'Point':
                newFeatureView = new app.views.PointEditView({
                    layerGroup: this.layerGroup,
                    featureJson: featureJson
                });
                break;
            case 'LineString':
                newFeatureView = new app.views.LineStringEditView({
                    layerGroup: this.layerGroup,
                    featureJson: featureJson
                });
                break;
            } 
            if (!_.isUndefined(newFeatureView)){
                this.featureOverlay.addFeature(newFeatureView.olFeature);
                featureObj.olFeature = newFeatureView.getFeature();
                newFeatureView.featureObj = featureObj;
                featureObj.olFeature['model'] = featureObj;
                featureObj.olFeature['view'] = newFeatureView;
                featureObj.olFeature.on('change', function(event) {
                    var geometry = event.target.get('geometry');
                    var view = event.target['view'];
                    view.updateCoordsFromGeometry(geometry);
                });
                this.features.push(newFeatureView);
            }
        },
        
        deleteFeatureFromOverlay: function() {
        	// remove the selected features from the overlay
        	var features = app.request('selectedFeatures');
        	var _this = this;
        	_.each(features, function(feature){
        		var olFeature = feature.olFeature;
        		_this.featureOverlay.removeFeature(olFeature);
        	});
        },
        
        updateFeaturePosition: function(feature) {
    		var olFeature = feature.olFeature;
    		if (type == 'Point') {
    			var newPoint = new ol.geom.Point(transform(feature.get('point')));
        		olFeature.setGeometry(newPoint);
        	} else if (type == 'Polygon') {
        		var coords = this.feature.get('polygon')
        		var newPolygon = new ol.geom.Polygon([coords]).transform('EPSG:4326', 'EPSG:3857');
        		olFeature.setGeometry(newPolygon);
        	} else if (type == 'LineString') {
        		var newLineString = new ol.geom.LineString(feature.get('lineString')).transform('EPSG:4326', 'EPSG:3857');
        		olFeature.setGeometry(newLineString);
        	} 
        	
        },
        //clean up, then re-enter the mode. Useful for redraws
        resetMode: function() {
        	if (this.currentMode) {
        		var mode = this.currentMode;
        		mode.exit.call(this);
        		mode.enter.call(this);
        	}
        },
        setMode: function(modeName) {
            var modeMap = {
                'addFeatures' : 'addFeaturesMode',
                'navigate' : 'navigateMode',
                'reposition' : 'repositionMode'
            };
            
            if (this.currentMode) {
                this.currentMode.exit.call(this);
            }
            var mode = _.isObject(modeName) ? modeName : this[modeMap[modeName]];
            mode.enter.call(this);
            this.currentMode = mode;
            this.currentModeName = modeName;
        },
        
        addDrawInteraction(typeSelect) {
			this.featureAdder = new ol.interaction.Draw({
				features: this.featureOverlay.getFeatures(),
				type:  /** @type {ol.geom.GeometryType} */ (typeSelect),
				deleteCondition: function(event) {
                    return ol.events.condition.shiftKeyOnly(event) &&
                        ol.events.condition.singleClick(event);
                }
			}, this);
			this.featureAdder.on('drawend', function(event) { // finished drawing this feature
				//create a new backbone feature obj
				var featureObj = app.util.createBackboneFeatureObj(event.feature);
			}, this);
			this.map.addInteraction(this.featureAdder);
        },
        addFeaturesMode: {
        	// in this mode, user can add features (all other features are locked)
        	enter: function() {
                $("#noEditingTools").hide();

                app.editingTools.show(new app.views.EditingToolsView());
                app.vent.trigger('editingToolsRendered');
                app.State.disableAddFeature = false;
				if (this.featureAdder) {
					this.map.removeInteraction(this.featureAdder);
				} 
    			this.addDrawInteraction(this.typeSelect);
        	}, 
        	exit: function() {
        		this.map.removeInteraction(this.featureAdder);
        		app.editingTools.reset();
        		$("#noEditingTools").show();
        	}
        },
        navigateMode: {
        	// in this mode, user can only navigate around the map (all features are locked)
        	enter: function() {
        		//no op
        	}, 
        	exit: function() {
        		//no op
        	}
        },
        repositionMode: {
        	// in this mode, user can edit any existing features but cannot add a new feature.
        	enter: function() {
        		app.State.popupsEnabled = false;
        		if (_.isUndefined(this.repositioner)) {
        			this.repositioner = new ol.interaction.Modify({
        				features: this.featureOverlay.getFeatures(),
        				deleteCondition: function(event) {
        					return ol.events.condition.shiftKeyOnly(event) &&
        						ol.events.condition.singleClick(event);
        				}
        			});
//        			this.featureDeleter.getFeatures().on('add', function(e) {
//        				var feature = e.element;
//        				var model = feature.get('model');
//        				if (!_.isUndefined(model)){
//        					this.collection.removeFeature(model);
//        				}
//        			}, this);
        		} 
    			this.map.addInteraction(this.repositioner);
//    			this.map.addInteraction(this.featureDeleter);
    			//TODO: upon edit, need to resave to the database!
    			
        	}, //end enter
        	exit: function() {
                this.map.removeInteraction(this.repositioner);
                this.map.removeInteraction(this.featureDeleter);
        	}
        } // end repositionMode
    });

    app.views.PolygonEditView = app.views.PolygonView.extend({
    	render: function() {
    		//no op
    	},
    	updateCoordsFromGeometry: function(geometry) {
            var coords = inverseList(geometry.flatCoordinates);
            this.featureObj.set('polygon',coords);
            this.featureObj.trigger('coordsChanged');
            this.featureObj.save();
    	}
    });

    app.views.PointEditView = app.views.PointView.extend({
    	render: function() {
    		// no op
    	},
    	updateCoordsFromGeometry: function(geometry) {
            var coords = inverse(geometry.flatCoordinates);
            this.featureObj.set('point',coords);
            this.featureObj.trigger('coordsChanged');
            this.featureObj.save();
        }
    });

    app.views.LineStringEditView = app.views.LineStringView.extend({
    	render: function() {
    		// no op
    	},
    	updateCoordsFromGeometry: function(geometry) {
            var coords = inverseList(geometry.flatCoordinates);
            this.featureObj.set('lineString',coords);
            this.featureObj.trigger('coordsChanged');
            this.featureObj.save();
        }
    });

    app.views.GroundOverlayEditView = app.views.GroundOverlayView.extend({
        render: function() {
            //no op
        },
        updateCoordsFromGeometry: function(geometry) {
            var coords = inverseList(geometry.flatCoordinates);
            this.featureObj.set('polygon',coords);
            this.featureObj.trigger('coordsChanged');
            this.featureObj.save();
        }
    });

});


