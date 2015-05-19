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
            /*var extent = this.mapEditorGroup.getExtent();
            if (!_.isUndefined(extent)) {
                map.getView().fitExtent(extent, map.getSize());
             } */
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
    		app.views.MapLayerView.prototype.initialize.call(this, options);
    		app.vent.on('mapmode', this.setMode, this);
    		app.vent.trigger('mapmode', 'navigate');
    		this.map = this.options.map;
    		
    		this.featureOverlay = new ol.FeatureOverlay({
      		  style: app.util.getDefaultStyle()
      		});
      		this.featureOverlay.setMap(this.map);
    	},
        getFeatures: function() {
            var mapLayer = app.mapLayer;
            var featuresJSON = []
            if (app.mapLayer && app.mapLayer.get('feature')) {
                var features = app.mapLayer.get('feature');
                $.each(features.models, function(index, feature){
                    featuresJSON.push(feature.toJSON());
                });
            }
            return featuresJSON;
        },
        constructFeatures: function() {
            if (_.isUndefined(this.layerGroup)){
                this.layerGroup = new ol.layer.Group({name: this.mapLayerJson.name});
            };
            var mlview = this;
            $.each(mlview.mapLayerJson, function(index, value) {
                    mlview.createFeature(value);
            });
        },
        createFeature: function(featureJson){
            var newFeature;
            switch (featureJson['type']){
            case 'GroundOverlay':
                newFeature = new app.views.GroundOverlayEditView({
                    layerGroup: this.layerGroup,
                    featureJson: featureJson
                });
                this.drawBelow = true;
                break;
            case 'Polygon':
                newFeature = new app.views.PolygonEditView({
                    layerGroup: this.layerGroup,
                    featureJson: featureJson
                });
                break;
            case 'Point':
                newFeature = new app.views.PointEditView({
                    layerGroup: this.layerGroup,
                    featureJson: featureJson
                });
                break;
            case 'LineString':
                newFeature = new app.views.LineStringEditView({
                    layerGroup: this.layerGroup,
                    featureJson: featureJson
                });
                break;
            } 
            if (!_.isUndefined(newFeature)){
                this.features.push(newFeature);
            }
        },
        render: function() {
            this.show();
            if (this.currentMode) {
            	this.resetMode();
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
        
//        app.util.addDrawTypeSelectChangeCallBack();
        
//     // add draw interaction to the map.
//    	addInteraction: function(typeSelect) {
//    	  var map = app.map.map;
//		  draw = new ol.interaction.Draw({
//		    features: featureOverlay.getFeatures(),
//		    type: /** @type {ol.geom.GeometryType} */ (typeSelect.value)
//		  });
//		  map.addInteraction(draw);
//		  //when user draws a feature, save it as a backbone and db obj.
//		  draw.on('drawend', function(event) { // finished drawing this feature
//			  var feature = event.feature;
//			  var geom = feature.getGeometry();
//			  var type = geom.getType();
//			  var coords = geom.getCoordinates();
//			  //create a new backbone feature obj
//			  var featureObj = app.util.createBackboneFeatureObj(type, coords);
//			  //save to DB
//			  featureObj.save(null, {
//				  type: 'POST'
//			  });
//		  });
//    	},
//    	// draw type selection change 
//    	addDrawTypeSelectChangeCallBack: function() {
//	    	var map = app.map.map;
//	    	var typeSelect = document.getElementById('type');
//			/**
//			 * Let user change the geometry type.
//			 * @param {Event} e Change event.
//			 */
//			typeSelect.onchange = function(e) {
//			  map.removeInteraction(draw);
//			  app.util.addInteraction(typeSelect);
//			};
//			app.util.addInteraction(typeSelect);
//	    },
        addInteraction(typeSelect) {
			this.featureAdder = new ol.interaction.Draw({
				features: this.featureOverlay.getFeatures(),
				type:  /** @type {ol.geom.GeometryType} */ (typeSelect.value)
			}, this);
			this.featureAdder.on('drawend', function(event) { // finished drawing this feature
				var feature = event.feature;
				var geom = feature.getGeometry();
				var type = geom.getType();
				var coords = geom.getCoordinates();
				//create a new backbone feature obj
				var featureObj = app.util.createBackboneFeatureObj(type, coords);
				//save to DB
				featureObj.save(null, {
					type: 'POST'
				});
			});
			this.map.addInteraction(this.featureAdder);
        },
        addFeaturesMode: {
        	// in this mode, user can add features (all other features are locked)
        	enter: function() {
        		app.State.disableAddFeature = false;
        		var typeSelect = document.getElementById('type');
    			typeSelect.onchange = function(e) {
    				this.map.removeInteraction(this.featureAdder);
    				this.addInteraction(typeSelect);
    			};

    			if (_.isUndefined(this.featureAdder)){
        			this.addInteraction(typeSelect);
        		}
        	}, 
        	exit: function() {
        		this.map.removeInteraction(this.featureAdder);
        	}
        },
        navigateMode: {
        	// in this mode, user can only navigate around the map (all features are locked)
        	enter: function() {

        	}, 
        	exit: function() {

        	}
        },
        repositionMode: {
        	// in this mode, user can edit any existing features but cannot add a new feature.
        	enter: function() {

        	}, 
        	exit: function() {

        	}
        }
    });

    app.views.PolygonEditView = app.views.PolygonView.extend({
    	
    });

    app.views.PointEditView = app.views.PointView.extend({

    });

    app.views.LineStringEditView = app.views.LineStringView.extend({

    });

    app.views.GroundOverlayEditView = app.views.GroundOverlayView.extend({
        
    });

    app.views.HideableRegion = Backbone.Marionette.Region.extend({
        close: function() {
            Backbone.Marionette.Region.prototype.close.call(this);
            this.ensureEl();
            this.$el.hide();
        },
        show: function(view) {
            Backbone.Marionette.Region.prototype.show.call(this, view);
            this.$el.show();
        }
    });
});


