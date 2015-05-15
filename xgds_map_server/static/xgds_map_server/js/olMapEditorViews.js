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
                mapLayerGroup: this.mapEditorGroup
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

    app.views.EditingToolsView = Backbone.Marionette.ItemView.extend({
    	template: '#template-editing-tools',
    		
    	initialize: function() {
    		var map = app.map.map;
    		// featureOverlay is a global layer where all features get
    		// added to.
    		featureOverlay = new ol.FeatureOverlay({
    		  style: new ol.style.Style({
    		    fill: new ol.style.Fill({
    		      color: 'rgba(255, 255, 255, 0.2)'
    		    }),
    		    stroke: new ol.style.Stroke({
    		      color: '#ffcc33',
    		      width: 2
    		    }),
    		    image: new ol.style.Circle({
    		      radius: 7,
    		      fill: new ol.style.Fill({
    		        color: '#ffcc33'
    		      })
    		    })
    		  })
    		});
    		featureOverlay.setMap(map);
    
    		var modify = new ol.interaction.Modify({
    		  features: featureOverlay.getFeatures(),
    		  // the SHIFT key must be pressed to delete vertices, so
    		  // that new vertices can be drawn at the same position
    		  // of existing vertices
    		  deleteCondition: function(event) {
    		    return ol.events.condition.shiftKeyOnly(event) &&
    		        ol.events.condition.singleClick(event);
    		  }
    		});		
    		map.addInteraction(modify);
    	}
    });
});


