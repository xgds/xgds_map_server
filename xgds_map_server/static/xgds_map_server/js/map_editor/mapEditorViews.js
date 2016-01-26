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

app.views.LinksView = Backbone.Marionette.ItemView.extend({
    template: '#template-layer-links',
    initialize: function() {
        var source = $(this.template).html();
        this.template = Handlebars.compile(source);
    },
    render: function() {
        this.$el.html(this.template({
            layerUuid: app.mapLayer.get('uuid')
        }));
    }
});

app.views.ToolbarView = Backbone.Marionette.ItemView.extend({
    template: '#template-toolbar',
    events: {
        'click #btn-navigate': function() { app.vent.trigger('mapmode', 'navigate'); this.updateTip('clear');},
        'click #btn-reposition': function() { app.vent.trigger('mapmode', 'reposition'); this.updateTip('edit'); },
        'click #btn-addFeatures': function() { app.vent.trigger('mapmode', 'addFeatures'); this.updateTip('add');},
        'click #btn-saveas': function() { this.showSaveAsDialog(); },
        'click #btn-undo': function() { app.Actions.undo(); },
        'click #btn-redo': function() { app.Actions.redo(); },
        'click #btn-save': function() { this.saveEntireLayer();},
        'click #btn-delete': function() {window.location.href=app.options.deleteUrl}
    },

    initialize: function() {
        this.listenTo(app.vent, 'mapmode', this.ensureToggle);
        this.listenTo(app.vent, 'undoEmpty', this.disableUndo);
        this.listenTo(app.vent, 'redoEmpty', this.disableRedo);
        this.listenTo(app.vent, 'undoNotEmpty', this.enableUndo);
        this.listenTo(app.vent, 'redoNotEmpty', this.enableRedo);
        this.listenTo(app.mapLayer, 'sync', function(model) {this.updateSaveStatus('sync')});
        this.listenTo(app.mapLayer, 'error', function(model) {this.updateSaveStatus('error')});
        // todo listento sync of features
    },

    onShow: function() {
        if (!app.State.mapHeightSet) {
            var offset = this.$el.height() +
                parseFloat(this.$el.parent().css('margin-top')) +
                parseFloat(this.$el.parent().css('margin-bottom')) +
                10; // this exact number is needed because jquery ui uses
            // elements with absolute positioning for the resize handles
            var pageContentElement = $('#page-content');
            var oldMapHeight = app.map.$el.height();
            var initialHeight = oldMapHeight - offset;
            app.map.$el.height(initialHeight);
            app.map.$el.css('max-height', initialHeight + 'px');
            $(window).bind('resize', function() {
                app.map.$el.css('max-height', (pageContentElement.height() - offset) + 'px');
            });
            app.State.mapHeightSet = true;
            app.vent.trigger('doMapResize');
        }
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

    saveEntireLayer: function(){
//        var theFeatures = app.mapLayer.get('feature');
//        for (i = 0; i < theFeatures.models.length; i++){
//            theFeatures.models[i].save();
//        }
        app.mapLayer.save();
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
    }

});

app.views.EditingToolsView = Backbone.Marionette.ItemView.extend({
	template: '#template-editing-tools',
	close: function() {
        this.ensureEl();
        this.$el.hide();
    }
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


app.views.LayerInfoTabView = Backbone.Marionette.ItemView.extend({
	template: '#template-layer-info',
	initialize: function() {
	},
	events: {
		'change #mapLayerName': function(evt) {
			this.model.set('name', evt.target.value);
			this.model.save()
		},
		'change #mapLayerDescription': function(evt) {
			this.model.set('description', evt.target.value);
			this.model.save();
		}    
	},
	serializeData: function() {
		var data = this.model.toJSON();
		return data;
	}
});


app.views.FeaturesTabView = Backbone.Marionette.LayoutView.extend({
	template: '#template-features-view',
    regions: {
        //Column Headings
        colhead1: '#colhead1',
        colhead2: '#colhead2',
        colhead3: '#colhead3',
        
        //Column content
        col1: '#col1',
        col2: {
            selector: '#col2',
            regionType: app.views.HideableRegion
        },
		col3: {
		    selector: '#col3',
		    regionType: app.views.HideableRegion
		}
    },
	
    initialize: function() {
    	this.listenTo(app.vent, 'showFeature', this.showFeature, this);
        this.listenTo(app.vent, 'showNothing', this.showNothing, this);
        this.listenTo(app.vent, 'showStyle', this.showStyle, this);
        this.listenTo(app.vent, 'showCoordinates', this.showCoordinates, this);
    },
    
    clearColumns: function() {
    	// Clears 2nd and 3rd columns
        this.col2.reset();
        this.col3.reset();
    },
    
    onClose: function() {
    	this.stopListening();
    },
    
    onRender: function() {
        try {
            this.colhead1.close();
            this.col1.close();
            this.clearColumns()
        } catch (err) { 
        	
        }
    	var headerView = new app.views.FeaturesHeaderView({});
    	this.colhead1.show(headerView);

    	// view that shows list of feature elements
    	var featureCollectionView = new app.views.FeatureCollectionView ({
			collection: app.mapLayer.get('feature')
    	});
    	
    	try {
    		this.col1.show(featureCollectionView);
    	} catch (exception) {
    		console.log(exception)
    	}
    },
    
    showFeature: function(itemModel) {
    	// clear columns
    	try{
    		this.col3.reset();
    		this.colhead2.reset();
    	} catch (ex) {
    	}
    	
    	var headerView = new app.views.FeaturePropertiesHeaderView({
    		model: itemModel
    	});
    	
    	this.colhead2.show(headerView);
    	this.col2.reset();
    	this.colhead3.reset();
    	
    	var view = new app.views.FeaturePropertiesView({model: itemModel});
    	this.col2.show(view);
    },
    
    showStyle: function(model){
    	try {
    		this.col3.reset();
    		this.colhead3.reset();
    	} catch (ex) {
    	}
    	var headerView = new app.views.FeatureStyleHeader({model: model});
    	this.colhead3.show(headerView);
    	if (model.get('type') == 'Polygon') {
    		var view = new app.views.FeaturePolygonStyleForm({model: model});
    	} else if (model.get('type') == 'Point') {
    		var view = new app.views.FeaturePointStyleForm({model: model});
    	} else if (model.get('type') == 'LineString') {
    		var view = new app.views.FeatureLinestringStyleForm({model: model});
    	} 	
    	this.col3.show(view);
        this.col3.reset();
    }, 
    
    showCoordinates: function(model){
    	try {
    	    this.colhead3.close();
    	} catch (ex) {
    	}
    	var headerView = new app.views.FeatureCoordinatesHeader({model: model});
    	this.colhead3.show(headerView);
	var view = new app.views.FeatureCoordinatesView({model: model});
    	this.col3.show(view);
    },
    
    showNothing: function() {
        // clear the columns
        try {
            this.col2.close();
            this.col3.close();
            this.colhead2.close();
            this.colhead3.close();
        } catch (ex) {
            
        }
    }
});


/**
 * Model this after PropertiesForm in plan so that the model is immediately updated.
 */
app.views.FeatureStyleForm = Backbone.Marionette.ItemView.extend({
	template: '#template-feature-polygon-style-properties',
	serializeData: function() {
		var data = this.model.toJSON();
		//TODO: add more later
		return data;
	}
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


app.views.FeatureCoordinatesView = Backbone.Marionette.ItemView.extend({
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
		this.model.save();
		this.model.trigger('change:coordinates');
	},
	serializeData: function() {
		var coordinates = null;
		var markPolygon = false;
		var type = this.model.get('type');
		if (type == 'Polygon') {
			coordinates = this.model.get('polygon');
			markPolygon = true;
		} else if (type == 'LineString') {
			coordinates = this.model.get('lineString');
		} else if (type == 'Point') {
			coordinates = [this.model.get('point')];
		}
		return {coords: coordinates, polygon: markPolygon};
	}, 
});


app.views.FeatureCoordinatesHeader = Backbone.Marionette.ItemView.extend({
	template: '#template-feature-coordinates-header',
	serializeData: function() {
		var data = this.model.toJSON();
		return {type: data.type};
	}
});


app.views.FeatureStyleHeader = Backbone.Marionette.ItemView.extend({
	template: '#template-feature-style-header',
	serializeData: function() {
		var data = this.model.toJSON();
		return {type: data.type};
	}
});


app.views.FeaturePropertiesView = Backbone.Marionette.CompositeView.extend({
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
			this.model.save();
		}, 
		'change #featureDescription': function(evt) {
			this.model.set('description', evt.target.value);
			this.model.save();
		},
		'click #showLabel': function(evt) {
			this.model.set('showLabel', evt.target.checked);
			this.model.save();
		},
		'click #popup': function(evt) {
			this.model.set('popup', evt.target.checked);
			this.model.save();
		}
	}
});


app.views.FeaturesHeaderView = Backbone.Marionette.ItemView.extend({
    /*
     * This view also contains the copy, cut, delete btns for features.
     */
	template: '#template-features-header',
	events: {
		'click #btn-duplicate': function() { app.vent.trigger('duplicateSelectedFeatures', this.model)},
		'click #btn-delete': function() { app.vent.trigger('deleteSelectedFeatures', this.model)},
	}
});


app.views.FeaturePropertiesHeaderView = Backbone.Marionette.ItemView.extend({
	template: '#template-feature-properties-header',
	serializeData: function() {
		var data = this.model.toJSON();
		return {type: data.type};
	}
});


app.views.NoFeaturesView = Backbone.Marionette.ItemView.extend({
    template: '#template-no-features'
});


app.views.FeatureElementView = Backbone.Marionette.ItemView.extend({
	/**
	 * This view represents each feature element (each row in the first column).
	 */
    // The list item is a simple enough DOM subtree that we'll let the view build its own root element.
    tagName: 'li',
    initialize: function(options) {
        this.options = options || {};
        app.views.makeExpandable(this, this.options.expandClass);
    },
    template: function(data) {
        //return '' + data.model.toString()+ ' <i/>';
    	var displayName = data.model.toString();
        return '<input class="select" type="checkbox" id="id_' + displayName + '"/></i>&nbsp;<label style="display:inline-block;" for="id_' + displayName + '">' + displayName + '</label><i/>';
    },
    serializeData: function() {
        var data = Backbone.Marionette.ItemView.prototype.serializeData.call(this, arguments);
        data.model = this.model; // give the serialized object a reference back to the model
        data.view = this; // and view
        return data;
    },
    attributes: function() {
        return {
            'data-item-id': this.model.cid,
            'class': '-sequence-item' //only for css style purposes.
        };
    },
    events: {
        click: function() {
            app.State.metaExpanded = true;
            app.State.featureSelected = undefined;
            this.expand();
            app.vent.trigger('showFeature', this.model);
        }
    },
    isSelected: function(evt) {
        return this.$el.find('input.select').is(':checked');
    },
    modelEvents: {
        'change': 'render'
    },
    getSelectedStyles: function() {
    	return olStyles.styles['selected_' + this.model.get('type').toLowerCase()];
    }
});


app.views.FeatureCollectionView = Backbone.Marionette.CollectionView.extend({
	/**
	 * This view shows list of feature elements (entire first column)
	 */
	tagName: 'ul',
	className: 'feature-list',
	childView: app.views.FeatureElementView,
	emptyView: app.views.NoFeaturesView,
	initialize: function(options) {
		this.options = options || {};
		this.on('childview:expand', this.onItemExpand, this);
		app.reqres.setHandler('selectedFeatures', this.getSelectedFeatures, this);
		this.listenTo(app.vent, 'featuresSelected', this.enableFeatureActions);
		this.listenTo(app.vent, 'featuresUnSelected', this.disableFeatureActions);
		this.listenTo(app.vent, 'deleteSelectedFeatures', this.deleteSelectedFeatures);
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

		// change the style of the selected polygon.
		app.State.featureSelected.olFeature.setStyle(childView.getSelectedStyles());

		// reset the styles of all feature items that are not currently expanded/selected.
		//TODO: this loops over all features each time user selects a feature. Is there a more optimal way??
		this.children.each(function(view) {
			if ((view != childView)) {
				view.model.olFeature.setStyle(null);
			}
		});
		
	},   
    onClose: function(){
        this.children.each(function(view) {
        	console.log(view);
        });
    },
    duplicateSelectedFeatures: function() {
        var features = app.request('selectedFeatures');
        var selectParent = null;
        _.each(features, function(feature) {
            //HERETAMAR figure out how to clone a feature
            var olFeature = feature.clone();
            var featureObj = app.util.createBackboneFeatureObj(olFeature);
        });
    }, 
    deleteSelectedFeatures: function(){
    	var features = app.request('selectedFeatures');
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
    }
});




app.views.makeExpandable = function(view, expandClass) {
    /*
     * Call this on a view to indicate it is a expandable item in the three-column layout.
     * When the view's 'expand' event is triggered, it will display it's chevron and trigger
     * the global 'viewExpanded' event.  On recieving a global 'viewExpoanded' event with an
     * expandClass that matches its own, the view will remove it's chevron.
     */
    if (app.currentTab != 'features') {
        // memory leak work around
        return;
    }
    
    var expandable = {
        expand: function() {
            this.trigger('expand');
        },
        _expand: function() {
            var expandClass = this.options.expandClass;
            this.expanded = true;
            this._addIcon();
            app.vent.trigger('viewExpanded', this, expandClass);
            if (!_.isUndefined(this.onExpand) && _.isFunction(this.onExpand)) {
                this.onExpand();
            }
        },
        unexpand: function() {
            this.expanded = false;
            this.$el.find('i').removeClass('icon-play');
        },
        onExpandOther: function(target, expandClass) {
            if (this.options.expandClass === expandClass && this != target && target.isClosed != true) {
                this.unexpand();
            }
        },
        _ensureIcon: function() {
            if (view.$el.find('i').length == 0) {
                view.$el.append('<i/>');
            }
        },
        _restoreIcon: function() {
            if (this.expanded) {
                this._addIcon();
            }
        },
        _addIcon: function() {
            this._ensureIcon();
            this.$el.find('i').addClass('icon-play');
        },
        onClose: function() {
            this.stopListening();
        }
    };
    view = _.defaults(view, expandable);
    view.options = _.defaults(view.options, {expandClass: expandClass});
    view.listenTo(app.vent, 'viewExpanded', view.onExpandOther, view);
    view.on('expand', view._expand, view);
    view.on('render', view._restoreIcon, view);
};


app.views.TabNavView = Backbone.Marionette.LayoutView.extend({
    template: '#template-tabnav',
    regions: {
        tabTarget: '#tab-target',
        tabContent: '#tab-content'
    },
    events: {
        'click ul.tab-nav li': 'clickSelectTab'
    },

    viewMap: {
    	'info': app.views.LayerInfoTabView,
    	'features': app.views.FeaturesTabView,
    	'layers': app.views.FancyTreeView,
        'search': app.views.SearchView,
        'links': app.views.LinksView
    },

    initialize: function() {
        this.on('tabSelected', this.setTab);
        this.listenTo(app.vent, 'setTabRequested', function(tabId) {
            this.setTab(tabId);
        });
        this.layersView = null;
    },

    onRender: function() {
        if (! this.options.initialTab) {
            this.options.initialTab = 'info';
        }
        if (!_.isUndefined(app.currentTab)) {
            this.trigger('tabSelected', app.currentTab);
        } else {
            this.trigger('tabSelected', this.options.initialTab);
        }
    },

    clickSelectTab: function(event) {
        var newmode = $(event.target).parents('li').data('target');
        this.trigger('tabSelected', newmode);
    },

    setTab: function(tabId) {
    	 var oldTab = app.currentTab;
         app.currentTab = tabId;
         if (oldTab == tabId){
             return;
         }
    	
        var $tabList = this.$el.find('ul.tab-nav li');
        $tabList.each(function() {
            li = $(this);
            if (li.data('target') === tabId) {
                li.addClass('active');
            } else {
                li.removeClass('active');
            }
        });
        var viewClass = this.viewMap[tabId];
        if (! viewClass) { return undefined; }
        var view = new viewClass({
            model: app.mapLayer
        });
        if (oldTab == 'layers'){
            this.tabContent.show(view, {preventClose: true});
        } else {
            if (tabId == 'layers'){
                if (!_.isNull(this.layersView)){
                    this.tabContent.show(this.layersView);
                } else {
                    this.layersView = view;
                    this.tabContent.show(view);
                }
            } else {
                this.tabContent.show(view);
            }
        }
        
        app.vent.trigger('tab:change', tabId);
    }
});