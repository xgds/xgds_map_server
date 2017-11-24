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

app.views = app.views || {};

app.views.LinksView = Marionette.View.extend({
    template: '#template-layer-links',
	events: {
		'click #btn-delete': function() {
			window.location.href = app.options.deleteUrl;
		}
	},
    templateContext: function() {
    	if (app.mapLayer !== undefined){
    		return {layerUuid: app.mapLayer.get('uuid')};
    	}
		return {layerUuid: ''};
    }
});

app.views.ToolbarView = Marionette.View.extend({
    template: '#template-toolbar',
    events: {
        'click #btn-navigate': function() { app.vent.trigger('mapmode', 'navigate'); this.updateTip('clear');},
        'click #btn-reposition': function() { app.vent.trigger('mapmode', 'reposition'); this.updateTip('edit'); },
        'click #btn-addFeatures': function() { app.vent.trigger('mapmode', 'addFeatures'); this.updateTip('add');},
        'click #btn-saveas': function() { this.showSaveAsDialog(); },
        'click #btn-undo': function() { app.Actions.undo(); },
        'click #btn-redo': function() { app.Actions.redo(); },
        'click #btn-save': function() { app.util.saveLayer();},
    },

    initialize: function() {
        this.listenTo(app.vent, 'mapmode', this.ensureToggle);
        this.listenTo(app.vent, 'undoEmpty', this.disableUndo);
        this.listenTo(app.vent, 'redoEmpty', this.disableRedo);
        this.listenTo(app.vent, 'undoNotEmpty', this.enableUndo);
        this.listenTo(app.vent, 'redoNotEmpty', this.enableRedo);
        this.listenTo(app.mapLayer, 'sync', function(model) {this.updateSaveStatus('sync')});
        this.listenTo(app.mapLayer, 'error', function(model) {this.updateSaveStatus('error')});
        this.listenTo(app.vent, 'appChanged', this.unsavedChanges);
    },

   onRender: function() {
       if (app.Actions.undoEmpty()) {
           this.disableUndo();
       } else {
           this.enableUndo();
       }
       if (app.Actions.redoEmpty()) {
           this.disableRedo();
       } else {
           this.enableRedo();
       }
   },

    disableForReadOnly: function() {
        this.$('#btn-save').attr('disabled', 'true');
    },

    disableUndo: function() {
        this.$('#btn-undo').attr('disabled', 'true');
    },

    disableRedo: function() {
        this.$('#btn-redo').attr('disabled', 'true');
    },

    enableUndo: function() {
        this.$('#btn-undo').removeAttr('disabled');
    },

    enableRedo: function() {
        this.$('#btn-redo').removeAttr('disabled');
    },

	unsavedChanges: function(){
    	var notifier = document.getElementById("unsaved-notification");
		notifier.style.visibility = "visible";
	},

    ensureToggle: function(modeName) {
        var btn = $('#btn-' + modeName);
        if (! btn.hasClass('active')) { 
            btn.prop("checked", true); 
            btn.addClass('active');
        }
        // turn off the others
        btn.siblings().each(function() {
            $(this).prop("checked", false);
            $(this).removeClass("active");
        });
    },

    updateSaveStatus: function(eventName) {
        var msgMap = {
            'change': 'Unsaved changes.',
            'sync': 'Map layer saved.',
            'error': 'Save error.',
            'clear': '',
        };
        if (eventName == 'change') {
            app.dirty = true;
        } else if (eventName == 'sync') {
            app.dirty = false;
        }

        var msg = msgMap[eventName];
        this.$el.find('#save-status').text(msg);
        if (eventName == 'change' || eventName == 'error') {
            this.$el.find('#save-status').addClass('notify-alert');
        } else {
            this.$el.find('#save-status').removeClass('notify-alert');
        }
    },

    updateTip: function(eventName) {
        var msgMap = {
            'edit': 'Click and drag blue dot to edit.  Shift-click to delete a vertex.',
            'add': 'Double click to finish a line or polygon. Shift-click to delete a vertex.',
            'clear': 'Click and drag to pan map.'
        };
        var msg = msgMap[eventName];
        this.$el.find('#tip-status').text(msg);
    },

    refreshSaveAs: function(model, response) {
        var text = response.responseText;
        if (response.data != null) {
            var newId = response.data;
            if (newId != null) {
                document.location.href = newId;
            } else {
                app.vent.trigger('sync');
            }
        } else {
            app.vent.trigger('sync');
        }
    },
    
    showSaveAsDialog: function() {
    	$('#saveAsName').val(app.mapLayer.attributes['name']);
    	$('#saveAsDialog').dialog({
    		dialogClass: 'no-close',
    		modal: false,
    		resizable: true,
    		closeOnEscape: true,
    		buttons: {
    			'Cancel': function() {
    				$(this).dialog('close');
    			},
    			'Save': function() {
    				var newName = $('#saveAsName').val()
    				app.mapLayer.set('name', newName);
    				app.mapLayer.set('uuid', null);
    				app.mapLayer.save({type: 'POST', contentType: "application/json"});
    				$(this).dialog('close');
    			}
    		},
            position: {
                my: 'right top',
                at: 'right bottom',
                of: '#tab-buttons'
            },
            dialogClass: 'saveAs'
    	});
    },

});

app.views.AddFeatureToolsView = Marionette.View.extend({
	template: '#template-addfeature-tools',
	initialize: function() {
		this.listenTo(app.vent, 'initializeColorPicker', this.initializeColorPicker);
    },
	initializeColorPicker: function(){
		$("#color-picker").spectrum({
			showPaletteOnly: true,
			preferredFormat: "hex",
			color: "blue",
			showPalette: true,
			//TODO: Move palette into a config file that is loaded in
			palette: [
				["#00f", "#f0f"],
				["#fff", "#f90"],
				["#ff0", "#0f0"]
			]
		});

		this.setColor();
	},
	setColor: function(){
		if (app.mapLayer.attributes.defaultColor == null || app.mapLayer.attributes.defaultColor == ""){
			$("#color-picker").spectrum("set", "#00f");
		}

		else{
			$("#color-picker").spectrum("set", app.mapLayer.attributes.defaultColor);
		}
	},
	close: function() {
        this.ensureEl();
        this.$el.hide();
    }
});

app.views.EditFeatureToolsView = Marionette.View.extend({
	template: '#template-editfeature-tools',
	initialize: function() {

    },
	close: function() {
        this.ensureEl();
        this.$el.hide();
    }
});

app.views.NavigateView = Marionette.View.extend({
	template: '<div>&nbsp;<br/></div>'
});

app.views.LayerInfoTabView = Marionette.View.extend({
	template: '#template-layer-info',
	initialize: function() {
		this.listenTo(app.vent, 'initializeInfoColorPicker', this.initializeInfoColorPicker);
		this.listenTo(app.vent, 'infoPickerChanged', this.setDefaultStyle);
	},
	events: {
		'change #mapLayerName': function(evt) {
			this.model.set('name', evt.target.value);
			app.vent.trigger('appChanged');
		},
		'change #mapLayerDescription': function(evt) {
			this.model.set('description', evt.target.value);
			app.vent.trigger('appChanged');
		}
	},
	//This function supports navigating away from the info tab and back to it, fires after the onShow
	// event so we know the color picker is actually in the view (part of Marionette)
	onDomRefresh: function(){
		app.vent.trigger('initializeInfoColorPicker');
	},
	initializeInfoColorPicker: function(){
		$("#info-color-picker").spectrum({
			showPaletteOnly: true,
			color: "blue",
			showPalette: true,
			palette: [
				["#00f", "#f0f"],
				["#fff", "#f90"],
				["#ff0", "#0f0"]
			],
			change: function(color){
				app.vent.trigger('infoPickerChanged', color.toHexString());
			}
		});

		this.setColorPicker();
	},
	setColorPicker: function(){
		if (this.model.attributes.defaultColor == null || this.model.attributes.defaultColor == ""){
			$("#info-color-picker").spectrum("set", "#00f");
		}

		else{
			$("#info-color-picker").spectrum("set", this.model.attributes.defaultColor);
		}
	},
	setDefaultStyle: function(color){
		this.model.set('defaultColor', color);
		app.vent.trigger('appChanged');
	}
});


app.views.FeaturesTabView = Marionette.View.extend({
	template: '#template-features-view',
    regions: {
        //Column Headings
        colhead1: '#colhead1',
        colhead2: '#colhead2',
        
        //Column content
        col1: '#col1',
        col2: {
            selector: '#col2'
        },
    },
	events: {
		'click #btn-delete': function() { app.vent.trigger('deleteSelectedFeatures', this.model)},
		'click #btn-copy': function() { app.vent.trigger('copyFeatures'); },
		'click #btn-paste': function() { app.vent.trigger('pasteFeatures') },
		'click #btn-toggle-coordinates': function(){
			var expandedModel = app.views.FeatureCollectionView.prototype.getExpandedItem();
			this.showCoordinates(expandedModel);
		},
		'click #btn-toggle-properties': function(){
			var expandedModel = app.views.FeatureCollectionView.prototype.getExpandedItem();
			this.showFeature(expandedModel);
		},
		'click #btn-newLayer': function() {
			$('#newLayerModal').modal();
			app.vent.trigger('getSelectedFeatures');
        }
	},
    initialize: function() {
    	this.listenTo(app.vent, 'showFeature', this.showFeature, this);
        this.listenTo(app.vent, 'showNothing', this.showNothing, this);
        this.listenTo(app.vent, 'showStyle', this.showStyle, this);
        this.listenTo(app.vent, 'sendSelectedFeatures', this.getJsonFeatures);
        this.listenTo(app.vent, 'deleteSelectedFeatures', this.clearColumns, this);
    },
    
    clearColumns: function() {
    	// Clears 2nd and 3rd columns
        this.getRegion('col2').reset();
    },
    
    onClose: function() {
    	this.stopListening();
    },
    
    onRender: function() {
        try {
            this.getRegion('colhead1').close();
            this.getRegion('col1').close();
            this.clearColumns()
        } catch (err) { 
        	
        }
    	var headerView = new app.views.FeaturesHeaderView({});
    	this.getRegion('colhead1').show(headerView);

    	// view that shows list of feature elements
    	var featureCollectionView = new app.views.FeatureCollectionView ({
			collection: app.mapLayer.get('feature')
    	});
    	
    	try {
    		this.getRegion('col1').show(featureCollectionView);
    	} catch (exception) {
    		console.log(exception)
    	}
    },
    
    showFeature: function(itemModel) {
    	// clear columns
    	try{
    		this.getRegion('colhead2').reset();
    	} catch (ex) {
    	}
    	
    	var headerView = new app.views.FeaturePropertiesHeaderView({
    		model: itemModel
    	});
    	
    	this.getRegion('colhead2').show(headerView);
    	this.getRegion('col2').reset();
    	
    	var view = new app.views.FeaturePropertiesView({model: itemModel});
    	this.getRegion('col2').show(view);
    	app.vent.trigger('initializeEditColorPicker');
    },
    
    showStyle: function(model){
    	try {
    		this.getRegion('col3').reset();
    		this.getRegion('colhead3').reset();
    	} catch (ex) {
    	}
    	var headerView = new app.views.FeatureStyleHeader({model: model});
    	this.getRegion('colhead3').show(headerView);
    	if (model.get('type') == 'Polygon') {
    		var view = new app.views.FeaturePolygonStyleForm({model: model});
    	} else if (model.get('type') == 'Point') {
    		var view = new app.views.FeaturePointStyleForm({model: model});
    	} else if (model.get('type') == 'LineString') {
    		var view = new app.views.FeatureLinestringStyleForm({model: model});
    	} 	
    	this.getRegion('col3').show(view);
        this.getRegion('col3').reset();
    }, 
    
    showCoordinates: function(model){
    	try {
    		this.getRegion('col2').reset();
    	    this.getRegion('colhead2').reset();
    	} catch (ex) {
    	}
    	var headerView = new app.views.FeatureCoordinatesHeader({model: model});
    	this.getRegion('colhead2').show(headerView);
    	var view = new app.views.FeatureCoordinatesView({model: model});
    	this.getRegion('col2').show(view);
    },
    
    showNothing: function() {
        // clear the columns
        try {
            this.getRegion('col2').close();
            this.getRegion('colhead2').close();
        } catch (ex) {
            
        }
    },
	getJsonFeatures: function(selectedFeatures){
		$('#id_jsonFeatures').val(selectedFeatures);
	}
});


/**
 * Model this after PropertiesForm in plan so that the model is immediately updated.
 */
app.views.FeatureStyleForm = Marionette.View.extend({
	template: '#template-feature-polygon-style-properties'
});


app.views.FeaturePolygonStyleForm = app.views.FeatureStyleForm.extend({
	template: '#template-feature-polygon-style-properties'
});


app.views.FeatureLinestringStyleForm = app.views.FeatureStyleForm.extend({
	template: '#template-feature-linestring-style-properties'
});


app.views.FeaturePointStyleForm = app.views.FeatureStyleForm.extend({
	template: '#template-feature-point-style-properties'
});


app.views.FeatureCoordinatesView = Marionette.View.extend({
	template: '#template-feature-coordinates',
	events: {
		"change input.featureCoords": "coordsChanged"
	},
	initialize: function() {
	  this.listenTo(this.model, 'coordsChanged', this.render);
	},
	coordsChanged: function(e) {
		var coordIndex = parseInt(e.target.id);
		var coordValue = e.target.value;
		$("#coords-error-" + coordIndex).empty(); // clear the error msg
		coordValue = coordValue.split(',');
		if (coordValue.length != 2) { // show error msg if user does not enter a valid coord pair.
			$("#coords-error-" + coordIndex).html("Each coordinate must be a lon, lat pair.").css("color", "red");
			return;
		} 
		var newX = parseFloat(coordValue[0]);
		var newY = parseFloat(coordValue[1]);
		if (isNaN(newX) || isNaN(newY)) { // show error msg if coord is not a number.
			$("#coords-error-" + coordIndex).html("Coordinate must be a number").css("color", "red");
			return;
		}
		app.util.updateFeatureCoordinate(this.model.get('type'), this.model, newX, newY, coordIndex);
		this.model.trigger('change:coordinates');
		app.vent.trigger('appChanged');
	},
	templateContext: function() {
		var coordinates = null;
		var markPolygon = false;
		var type = this.model.get('type');
		if (type == 'Polygon') {
			coordinates = this.model.get('polygon');
			markPolygon = true;
		} else if (type == 'LineString') {
			coordinates = this.model.get('lineString');
		} else if (type == 'Point' || type == 'Station') {
			coordinates = [this.model.get('point')];
		}
		return {coords: coordinates, polygon: markPolygon};
	},
});


app.views.FeatureCoordinatesHeader = Marionette.View.extend({
	template: '#template-feature-coordinates-header',
	templateContext: function() {
		return {type: this.model.get('type')};
	}
});


app.views.FeatureStyleHeader = Marionette.View.extend({
	template: '#template-feature-style-header',
	templateContext: function() {
		return {type: this.model.get('type')};
	}
});


app.views.FeaturePropertiesView = Marionette.View.extend({
	template: '#template-feature-properties',
	events: {
		'click .feature-style': function(evt) {
			app.vent.trigger('showStyle', this.model);
		}, 
		'click .feature-coordinates': function(evt) {
			app.vent.trigger('showCoordinates', this.model);
		}, 
		'change #featureName': function(evt) {
			this.model.set('name', evt.target.value);
			app.util.updateJsonFeatures();
			app.vent.trigger('appChanged');
			app.Actions.action();
		}, 
		'change #featureDescription': function(evt) {
			this.model.set('description', evt.target.value);
			app.util.updateJsonFeatures();
			app.vent.trigger('appChanged');
			app.Actions.action();
		},
		'change #featureTolerance': function(evt){
			this.model.set('tolerance', evt.target.value);
			app.vent.trigger('changeTolerance');
			app.util.updateJsonFeatures();
			app.vent.trigger('appChanged');
			app.Actions.action();
		},
		'change #featureBoundary': function(evt){
			this.model.set('boundary', evt.target.value);
			app.vent.trigger('changeBoundary');
			app.util.updateJsonFeatures();
			app.vent.trigger('appChanged');
			app.Actions.action();
		},
		'click #showLabel': function(evt) {
			this.model.set('showLabel', evt.target.checked);
			app.util.updateJsonFeatures();
			app.vent.trigger('appChanged');
			app.Actions.action();
		},
		'click #popup': function(evt) {
			this.model.set('popup', evt.target.checked);
			app.util.updateJsonFeatures();
			app.vent.trigger('appChanged');
			app.Actions.action();
		},
	},
	initialize: function(){
		this.listenTo(app.vent, 'initializeEditColorPicker', this.initializeEditColorPicker);
		this.listenTo(app.vent, 'editPickerChanged', this.updateFeatureStyle);
	},
	onRender: function() {
		// app.vent.trigger('showCoordinates', this.model);
	},
	initializeEditColorPicker: function(){
		$("#edit-color-picker").spectrum({
			showPaletteOnly: true,
			color: "blue",
			showPalette: true,
			palette: [
				["#00f", "#f0f"],
				["#fff", "#f90"],
				["#ff0", "#0f0"]
			],
			change: function(color){
				app.vent.trigger('editPickerChanged', color.toHexString());
			}
		});

		this.setColorPicker();
	},
	setColorPicker: function(){
		if (this.model.get('style'))
			$("#edit-color-picker").spectrum("set", this.model.attributes.style);

		else
			$("#edit-color-picker").spectrum("set", "#00f");
	},
	updateFeatureStyle: function(color){
		this.model.set('style', color);
		app.util.updateJsonFeatures();
		app.vent.trigger('appChanged');
		app.Actions.action();
	}
});


app.views.FeaturesHeaderView = Marionette.View.extend({
    /*
     * This view also contains the copy, cut, delete btns for features.
     */
	template: '#template-features-header',
});


app.views.FeaturePropertiesHeaderView = Marionette.View.extend({
	template: '#template-feature-properties-header',
	templateContext: function() {
		return {type: this.model.get('type')};
	}
});


app.views.NoFeaturesView = Marionette.View.extend({
    template: '#template-no-features'
});


app.views.FeatureElementView = Marionette.View.extend({
	/**
	 * This view represents each feature element (each row in the first column).
	 */
    // The list item is a simple enough DOM subtree that we'll let the view build its own root element.
    tagName: 'li',
    initialize: function(options) {
        this.options = options || {};
        xGDS.makeExpandable(this, this.options.expandClass);
    },
    //template: '<span><input class="select" type="checkbox" id="id_{{uuid}}"/>&nbsp;<label class="featureName" style="display:inline-block;" for="id_{{uuid}}">{{displayname}}</label></span>',
    template: '<div><div class="form-check form-check-inline"><label class="form-check-label featureRow" for="id_{{uuid}}"><input class="form-check-input select" type="checkbox" id="id_{{uuid}}"/>{{displayname}}<i/></label></div></div>',
    onRender: function() {
    	var index = 0; //TODO fix app.mapLayer.get('jsonFeatures').features.indexOf(this.model.json);

    	var odd = index % 2;
    	var color = 'white';
    	if (odd) {
    		color = '#f2f2f2';
    	}
        this.$el.css('background-color', color);
    },
    templateContext: function() {
    	return  {displayname: this.model.toString(),
    		     uuid: this.model.get('uuid')};
    },
    attributes: function() {
        return {
            'data-item-id': this.model.cid,
            'class': '-sequence-item' //only for css style purposes.
        };
    },
    onExpand: function() {
    	if (app.State.featureSelected != undefined){
        	var checkbox = $('#id_' + app.State.featureSelected.get('uuid'));
        	if (checkbox.prop('checked')){
    			app.vent.trigger('selectStatusChanged', app.State.featureSelected, "Selected");
    			app.vent.trigger('selectFeature', this.model.olFeature);
        	} else {
        	    app.vent.trigger('selectStatusChanged', app.State.featureSelected, "Deselected");
        	    app.vent.trigger('unselectFeature', this.model.olFeature);
        	}
        }
        else{
    		app.vent.trigger('selectFeature', this.model.olFeature);
		}
        app.vent.trigger('selectStatusChanged', this.model, "Active");
        app.State.metaExpanded = true;
        app.State.featureSelected = this.model;
        app.vent.trigger('showFeature', this.model);
		app.vent.trigger('initializeEditColorPicker');

    },
    events: {
    	'click .featureRow': function() {
    		this.expand(this);
    	},
//        'click .featureRow': function() {
//            this.expand(this);

//            if (app.State.featureSelected != undefined){
//            	var checkbox = $('#id_' + app.State.featureSelected.get('uuid'));
//	        	if (checkbox.prop('checked')){
//	    			app.vent.trigger('selectFeature', app.State.featureSelected);
//	        	} else {
//	        	    app.vent.trigger('deselectFeature', app.State.featureSelected);
//	        	}
//            }
//            app.vent.trigger('activeFeature', this.model);
//            app.State.metaExpanded = true;
//            app.State.featureSelected = this.model;
            //this.expand(this);
            //app.vent.trigger('showFeature', this.model);
  //      },
    	'click .select': function(evt) {
        	if (app.State.featureSelected != this.model){
        	    if (evt.target.checked){
					app.vent.trigger('selectStatusChanged', this.model, "Selected");
        	    } else {
					app.vent.trigger('selectStatusChanged', this.model, "Deselected");
        	    }
        	}
    	}
    },
    isSelected: function(evt) {
        return this.$el.find('input.select').is(':checked');
    },
    modelEvents: {
        'change': 'render'
    }
});


app.views.FeatureCollectionView = Marionette.CollectionView.extend({
	/**
	 * This view shows list of feature elements (entire first column)
	 */
	tagName: 'ul',
	className: 'feature-list',
	childView: app.views.FeatureElementView,
	emptyView: app.views.NoFeaturesView,
	initialize: function(options) {
		this.options = options || {};
		this.listenTo(app.vent, 'selectedFeatures', this.getSelectedFeatures);
		this.listenTo(app.vent, 'featuresSelected', this.enableFeatureActions);
		this.listenTo(app.vent, 'featuresUnSelected', this.disableFeatureActions);
		this.listenTo(app.vent, 'deleteSelectedFeatures', this.deleteSelectedFeatures);
		this.listenTo(app.vent, 'getSelectedFeatures', this.sendSelectedFeatures);
		this.listenTo(app.vent, 'copyFeatures', this.copyFeatures);
		this.listenTo(app.vent, 'pasteFeatures', this.pasteFeatures);
		this.on('childview:expand', function(childView) { this.onItemExpand(childView);}, this);
	},
	childViewOptions: {
		expandClass: 'col1'
	},
	onItemExpand: function(childView) {
		/*
		 * This gets called when a feature is expanded (shows chevron) 
		 */
		// if there is a previously selected feature, revert the style to default.
		app.State.featureSelected = childView.model;
		app.vent.trigger('itemSelected', childView.model);
	},
	getExpandedItem: function(){
		return app.State.featureSelected;
	},
    deleteSelectedFeatures: function(){
    	var features = this.getSelectedFeatures();
    	var selectParent = null;
    	_.each(features, function(feature) {
    	    app.vent.trigger('deleteFeature', feature);
    	});
    },
    getSelectedFeatures: function() {
		var features = [];
		this.children.each(function(childView) {
		    try {
			if (childView.isSelected()) {
			    features.push(childView.model);
			}
		    } catch (ex) {
			// pass
		    }
		});
		return features;
    },
	copyFeatures: function(){
		var features = this.getSelectedFeatures();
		features = this.formatFeatures(features);

		if (features == null){
			this.hideClipboardMsgs();
			$('#copy-warning').show();
		}

		else{
			this.hideClipboardMsgs();

			$.ajax({
				type: "POST",
				dataType: 'json',
				url: "/xgds_map_server/copyFeatures",
				data: {features: features}
			});

			$('#copy-success').show();
		}
	},
	pasteFeatures: function(){
		if (copiedFeatures){
			this.hideClipboardMsgs();

			$.each(copiedFeatures.features, function(index, featureJson) {
				try{
					var featureObj = new app.models.Feature(featureJson);
					featureObj.json = featureJson;
					featureObj.set('mapLayer', app.mapLayer);  // set up the relationship.
					featureObj.set('mapLayerName', app.mapLayer.get('name'));
					featureObj.set('uuid', new UUID(4).format());
					featureObj.set('name', app.util.generateFeatureName(featureJson.type))
					app.vent.trigger('newFeatureLoaded', featureObj);
					app.vent.trigger('appChanged');
					$('#paste-success').show();
				}

				catch(err){
					$('#paste-exists').show();
				}
			});

			app.util.updateJsonFeatures();
			app.Actions.action();
		}

		else{
			this.hideClipboardMsgs();
			$('#paste-warning').show();
		}
	},
	hideClipboardMsgs: function(){
		$('#paste-success').hide();
		$('#paste-warning').hide();
		$('#paste-exists').hide();
		$('#copy-success').hide();
		$('#copy-error').hide();
		$('#copy-warning').hide();
	},
	sendSelectedFeatures:function(){
    	var features = this.getSelectedFeatures();
    	features = this.formatFeatures(features);
    	app.vent.trigger('sendSelectedFeatures', features);
	},
	formatFeatures: function(features){
		if (features.length <= 0)
			return null;

		var featureFormatter = {};
		featureFormatter['features'] = features;

		return JSON.stringify(featureFormatter);
	}
});



app.views.TabNavView = xGDS.TabNavView.extend({
    viewMap: {
    	'info': app.views.LayerInfoTabView,
    	'features': app.views.FeaturesTabView,
    	'layers': app.views.FancyTreeView,
        'search': app.views.SearchView,
        'links': app.views.LinksView
    },

    initialize: function() {
    	xGDS.TabNavView.prototype.initialize.call(this);
        var context = this;
        this.listenTo(app.vent, 'onLayerLoaded', function() {
        	 this.setTab('info');
        	 app.vent.trigger('initializeInfoColorPicker');
        }, this);
        this.listenTo(app.vent, 'actionLayerLoaded', function(){
        	this.setTab('info'); // Resets open feature properties
        	this.setTab('features');
		});
    },
    getModel: function() {
    	return app.mapLayer;
    }

});

