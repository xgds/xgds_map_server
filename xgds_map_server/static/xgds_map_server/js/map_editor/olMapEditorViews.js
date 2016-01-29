//__BEGIN_LICENSE__
//Copyright (c) 2015, United States Government, as represented by the
//Administrator of the National Aeronautics and Space Administration.
//All rights reserved.

//The xGDS platform is licensed under the Apache License, Version 2.0
//(the "License"); you may not use this file except in compliance with the License.
//You may obtain a copy of the License at
//http://www.apache.org/licenses/LICENSE-2.0.

//Unless required by applicable law or agreed to in writing, software distributed
//under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
//CONDITIONS OF ANY KIND, either express or implied. See the License for the
//specific language governing permissions and limitations under the License.
//__END_LICENSE__

$(function() {
    app.views = app.views || {};

    app.views.OLEditMapView =  app.views.OLMapView.extend({
	initialize: function(options) {
	    app.views.OLMapView.prototype.initialize.call(this);
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
	    app.vent.on('updateFeaturePosition', this.updateFeaturePosition, this);
	    app.vent.on('deleteFeatureSuccess', function(killedFeature) {
		this.olFeatures.remove(killedFeature.olFeature);
	    }, this);
	},
	createFeaturesLayer: function() {
	    this.olFeatures = new ol.Collection();
	    this.featuresVector = new ol.source.Vector({
		features: this.olFeatures,
		useSpatialIndex: false,
	    });
	    this.featuresLayer = new ol.layer.Vector({
		map: this.options.map,
		source: this.featuresVector,
		style: olStyles.getDefaultStyle()
	    });
	    /*
	    this.pointFeatures = new ol.Collection();
	    this.pointVector = new ol.source.Vector({
		features: this.pointFeatures,
		useSpatialIndex: false,
	    });
	    this.pointLayer = new ol.layer.Vector({
		map: this.options.map,
		source: this.pointVector,
		style: olStyles.getDefaultStyle()
	    }); */

	},
	initializeFeaturesJson: function() {
	    this.trigger('readyToDraw');
	},
	constructFeatures: function() {
	    if (_.isUndefined(this.layerGroup)){
		this.layerGroup = new ol.layer.Group({name: app.mapLayer.get('name')});
	    };
	    var _this = this;
	    var unconstructedFeatures = app.mapLayer.get('feature');
	    _.each(unconstructedFeatures.models, function(featureObj){
		_this.createFeature(featureObj);
	    });
	},
	createFeature: function(featureObj){
	    var newFeatureView;
	    var featureJson = featureObj.json;
	    switch (featureJson['type']){
	    case 'GroundOverlay':
		newFeatureView = new app.views.GroundOverlayEditView({
		    model: featureObj,
		    layerGroup: this.layerGroup,
		    featureJson: featureJson
		});
		this.drawBelow = true;
		break;
	    case 'Polygon':
		newFeatureView = new app.views.PolygonEditView({
		    model: featureObj,
		    layerGroup: this.layerGroup,
		    featureJson: featureJson
		});
		break;
	    case 'Point':
		newFeatureView = new app.views.PointEditView({
		    model: featureObj,
		    layerGroup: this.layerGroup,
		    featureJson: featureJson
		});
		break;
	    case 'LineString':
		newFeatureView = new app.views.LineStringEditView({
		    model: featureObj,
		    layerGroup: this.layerGroup,
		    featureJson: featureJson
		});
		break;
	    } 
	    if (!_.isUndefined(newFeatureView)){
		featureObj.olFeature = newFeatureView.getFeature();
		featureObj.olFeature.set('model', featureObj);
		featureObj.olFeature.getGeometry().set('view', newFeatureView);
		featureObj.olFeature.getGeometry().on('change', function(event) {
		    var geometry = event.target;
		    var view = event.target.get('view');
		    view.updateCoordsFromGeometry(geometry);
		});
		/*if (featureJson['type'] == 'Point'){
		    this.pointFeatures.push(featureObj.olFeature);
		} else {
		    this.olFeatures.push(featureObj.olFeature);
		}*/
		this.olFeatures.push(featureObj.olFeature);
		this.features.push(newFeatureView);
	    }
	},

	updateFeaturePosition: function(feature) {
	    var olFeature = feature.olFeature;
	    if (type == 'Point') {
		var newPoint = new ol.geom.Point(transform(feature.get('point')));
		olFeature.setGeometry(newPoint);
	    } else if (type == 'Polygon') {
		var coords = this.feature.get('polygon')
		var newPolygon = new ol.geom.Polygon([coords]).transform(LONG_LAT, DEFAULT_COORD_SYSTEM);
		olFeature.setGeometry(newPolygon);
	    } else if (type == 'LineString') {
		var newLineString = new ol.geom.LineString(feature.get('lineString')).transform(LONG_LAT, DEFAULT_COORD_SYSTEM);
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
	addDrawInteraction: function(typeSelect) {
	    var theFeaturesCollection = this.olFeatures;
	    /*if (typeSelect == 'Point'){
		theFeaturesCollection = this.pointFeatures;
	    }*/
	    this.featureAdder = new ol.interaction.Draw({
		features: theFeaturesCollection,
		type:  /** @type {ol.geom.GeometryType} */ (typeSelect),
		deleteCondition: function(event) {
		    return ol.events.condition.shiftKeyOnly(event) &&
		    ol.events.condition.singleClick(event);
		}
	    }, this);
	    this.featureAdder.on('drawend', function(event) { // finished drawing this feature
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
			features: this.olFeatures,
			deleteCondition: function(event) {
			    return ol.events.condition.shiftKeyOnly(event) &&
			    ol.events.condition.singleClick(event);
			}
		    });
		    
		    /*
		    this.pointDeleter = new ol.interaction.Select({
			layers: [this.pointLayer], 
			addCondition: function(event) {
			    return ol.events.condition.shiftKeyOnly(event)
			    && ol.events.condition.singleClick(event);
			}
		    });

		    this.pointDeleter.getFeatures().on('add', function(e) {
			var geometry = e.element.get('geometry');
			var type = geometry.getType();
			if (type == "Point") {
			    var model = e.element.get('model');
			    app.vent.trigger('deleteFeature', model);
			}
		    }, this);
		    
		    this.listenTo(app.vent, 'deleteFeatureSuccess', function(killedFeature) {
                        if (!_.isUndefined(killedFeature)){
                            var feature = killedFeature.olFeature;
                            if (!_.isUndefined(feature)){
//                        	this.pointDeleter.getFeatures().remove(feature);
                                var killed = this.pointFeatures.remove(feature);
                                if (killed != undefined){
                                    this.pointDeleter.getFeatures().remove(feature);
                                    this.pointVector.changed();
                                } else {
                                    this.olFeatures.remove(feature);
                                } 
                            }
                        }
                    }, this);
                    */
		} 
		this.map.addInteraction(this.repositioner);
//		this.map.addInteraction(this.pointDeleter);

	    }, //end enter
	    exit: function() {
		this.map.removeInteraction(this.repositioner);
//		this.map.removeInteraction(this.pointDeleter);
	    }
	} // end repositionMode
    });

    app.views.PolygonEditView = app.views.PolygonView.extend({
	initialize: function(options){
	    app.views.PolygonView.prototype.initialize.call(this, options);
	    this.listenTo(this.model, 'change:coordinates', function() {this.updateGeometryFromCoords()});
	},
	render: function() {
	    //no op
	},
	updateGeometryFromCoords: function(){
	    var coords = this.model.get('polygon');
	    var xcoords = transformList(coords);
	    var geom = this.olFeature.getGeometry();
	    geom.setCoordinates([xcoords], 'XY');
	    this.olFeature.changed();
	},
	updateCoordsFromGeometry: function(geometry) {
	    var coords = inverseList(geometry.getCoordinates().reduce(function(a, b) {
		return a.concat(b);
	    }));
	    var oldCoords = this.model.get('polygon');
	    if (!arrayEquals(coords, oldCoords)){
		// make sure first and last are the same, figure out which one changed
		if (coords[0] != coords[coords.length - 1]){
		    if (coords[0] != oldCoords[0] ) {
			coords[coords.length-1] = coords[0];
		    }
		}
		this.model.set('polygon',coords);
		this.model.trigger('coordsChanged');
		this.model.save();
	    }
	}
    });

    app.views.PointEditView = app.views.PointView.extend({
	initialize: function(options){
	    app.views.PointView.prototype.initialize.call(this, options);
	    this.listenTo(this.model, 'change:coordinates', function() {this.updateGeometryFromCoords()});
	},
	render: function() {
	    // no op
	},
	updateGeometryFromCoords: function(){
	    var coords = this.model.get('point');
	    var xcoords = transform(coords);
	    this.olFeature.getGeometry().setCoordinates(xcoords);
	    this.olFeature.changed();
	},
	updateCoordsFromGeometry: function(geometry) {
	    var coords = inverseTransform(geometry.getCoordinates());
	    if (!arrayEquals(coords, this.model.get('point'))){
		this.model.set('point',coords);
		this.model.trigger('coordsChanged');
		this.model.save();
	    }
	}, 
	destroy: function() {
	    this.model.destroy({
		data: { 'uuid': this.model.uuid },
		success: function(model, response) {
		    if(!_.isUndefined(this.model.collection)) {
			this.model.collection.remove(feature);
		    }
		}, 
		error: function() {
		    console.log("Error in deleting a feature");
		}
	    });
	}
    });

    app.views.LineStringEditView = app.views.LineStringView.extend({
	initialize: function(options){
	    app.views.LineStringView.prototype.initialize.call(this, options);
	    this.listenTo(this.model, 'change:coordinates', function() {this.updateGeometryFromCoords()});
	},
	render: function() {
	    // no op
	},
	updateGeometryFromCoords: function(){
	    var coords = this.model.get('lineString');
	    var xcoords = transformList(coords);
	    this.olFeature.getGeometry().setCoordinates(xcoords,'XY');
	    this.olFeature.changed();
	},
	updateCoordsFromGeometry: function(geometry) {
	    /*var coords = inverseList(geometry.getCoordinates().reduce(function(a, b) {
		return a.concat(b);
	    })); */
	    var coords = inverseList(geometry.getCoordinates());
	    if (!arrayEquals(coords, this.model.get('lineString'))){
		this.model.set('lineString',coords);
		this.model.trigger('coordsChanged');
		this.model.save();
	    }
	}
    });

    app.views.GroundOverlayEditView = app.views.GroundOverlayView.extend({
	initialize: function(options){
	    app.views.GroundOverlayView.prototype.initialize.call(this, options);
	    this.listenTo(this.model, 'change:coordinates', function() {this.updateGeometryFromCoords()});
	},
	render: function() {
	    //no op
	},
	updateGeometryFromCoords: function(){
	    var coords = this.model.get('polygon');
	    var xcoords = transformList(coords);
	    var geom = this.olFeature.getGeometry();
	    geom.setCoordinates([xcoords],'XY');
	    this.olFeature.changed();
	},
	updateCoordsFromGeometry: function(geometry) {
	    var coords = inverseList(geometry.getCoordinates().reduce(function(a, b) {
		return a.concat(b);
	    }));
	    this.model.set('polygon',coords);
	    this.model.trigger('coordsChanged');
	    this.model.save();
	}
    });

});


