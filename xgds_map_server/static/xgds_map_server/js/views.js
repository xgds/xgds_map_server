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

app.views = app.views || {};

app.views.ToolbarView = Backbone.Marionette.ItemView.extend({
    template: '#template-toolbar',
    events: {
        'click #btn-save': function() { app.simulatePlan(); app.currentPlan.save() },
        'click #btn-saveas': function() { this.showSaveAsDialog(); },
        'click #btn-undo': function() { app.Actions.undo(); },
        'click #btn-redo': function() { app.Actions.redo(); }
    },

    initialize: function() {
        this.listenTo(app.vent, 'mapmode', this.ensureToggle);
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
            'sync': 'Plan saved.',
            'error': 'Save error.',
            'clear': '',
            'readOnly': 'Plan is LOCKED.'
        };
        if (app.options.readOnly) {
            eventName = 'readOnly';
        }
        if (eventName == 'change') {
            app.dirty = true;
        } else if (eventName == 'sync') {
            app.dirty = false;
        }

        var msg = msgMap[eventName];
        this.$el.find('#save-status').text(msg);
        if (eventName == 'change' || eventName == 'error' || eventName == 'readOnly') {
            this.$el.find('#save-status').addClass('notify-alert');
        } else {
            this.$el.find('#save-status').removeClass('notify-alert');
        }
    },

    updateTip: function(eventName) {
        var msgMap = {
            'edit': 'Shift click to delete stations, click & drag the blue dot to edit.',
            'add': 'Click to add stations to end.  Double-click last station.',
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

app.views.LayersView = Backbone.View.extend({
	template: '#template-layers',
	
	events: {
		
	},
	
	initialize: function() {
		var source = $(this.template).html();
		if(_.isUndefined(source))
			this.template = function() {
			return '';
		};
		else {
			this.template = Handlebars.compile(source);
		}
		_.bindAll(this, 'render', 'afterRender');
		var _this = this;
		this.render = _.wrap(this.render, function(render) {
			render();
			_this.afterRender();
			return _this;
		});
	},
	
	render: function() {
		//TODO: values should be from current layer object.
        this.$el.html(this.template({
//            name: "dummy name",
//            description: "dummy description",
//            modifier: "dummy modifier",
//            modified: "dummy date time",
//            creator: "dummy creator",
//            created: "dummy date time"
        }));
	},
	
	afterRender: function() {
	}
});


//TODO: rewrite this using a schema and backbone form!!
app.views.LayerInfoTabView = Backbone.View.extend({
	template: '#template-layer-info',
	events: {
		
	},
	initialize: function() {
		var source = $(this.template).html();
		if(_.isUndefined(source))
			this.template = function() {
			return '';
		};
		else {
			this.template = Handlebars.compile(source);
		}
		_.bindAll(this, 'render', 'afterRender');
		var _this = this;
		this.render = _.wrap(this.render, function(render) {
			render();
			_this.afterRender();
			return _this;
		});
	},
	render: function() {
		//TODO: values should be from current layer object.
        this.$el.html(this.template({
            name: "dummy name",
            description: "dummy description",
            modifier: "dummy modifier",
            modified: "dummy date time",
            creator: "dummy creator",
            created: "dummy date time"
        }));
	},
	afterRender: function() {
	}
});


app.views.FeaturesHeaderView = Backbone.Marionette.ItemView.extend({
    template: '#template-features-header'
});

app.views.FeaturePropertiesHeaderView = Backbone.Marionette.ItemView.extend({
    template: '#template-feature-properties-header'
});

app.views.NoFeaturesView = Backbone.Marionette.ItemView.extend({
    template: '#template-no-features'
});


app.views.FeatureListItemView = Backbone.Marionette.ItemView.extend({
    // The list item is a simple enough DOM subtree that we'll let the view build its own root element.
    tagName: 'li',
    initialize: function(options) {
        this.options = options || {};
        app.views.makeExpandable(this, this.options.expandClass);
    },
    template: function(data) {
        //return '' + data.model.toString()+ ' <i/>';
        return '{model.toString} <span class="duration">{timing}</span><i/>'.format(data);
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
            'class': this.model.get('type').toLowerCase() + '-sequence-item'
        };
    },
    events: {
        click: function() {
            this.expand();
        }
    },
    modelEvents: {
        'change': 'render'
    }
});


app.views.FeatureElementItemView = app.views.FeatureListItemView.extend({
    events: {
        click: function() {
//            app.State.metaExpanded = true;
//            app.State.addCommandsExpanded = false;
//            app.State.commandSelected = undefined;
            this.expand();
            var type = this.model.get('type'); //"feature"
            app.vent.trigger('showItem:' + type.toLowerCase(), this.model);
        }
    },
    onExpand: function() {


    },
    serializeData: function() {
        var data = app.views.FeatureListItemView.prototype.serializeData.call(this, arguments);
        return data;
    }
});


//subview for features tab (1st col, features list)
app.views.FeatureCollectionView = Backbone.Marionette.CollectionView.extend({
	className: 'feature-list',
	childView: app.views.FeatureElementItemView,
	childViewOptions: {
		expandClass: 'col1'
	},
	emptyView: app.views.NoFeaturesView,
	initialize: function(options) {
		this.options = options || {};
	},
	onItemExpand: function(childView) {
        app.State.featureSelected = childView.model;
    },
	
    restoreExpanded: function() {
        if (!_.isUndefined(app.State.featureSelected)) {
            var childView = this.children.findByModel(app.State.featureSelected);
            if (_.isUndefined(childView)) {
                // try to find the child view by ID since models change on save
                var childId = app.State.featureSelected.cid;
                var childModel = this.collection.get(childId);
                if (_.isUndefined(childModel)) {
                    // can't find by id, so the view is gone
                    app.State.featureSelected = undefined;
                    app.vent.trigger('showNothing');
                } else {
                    childView = this.children.findByModel(childModel);
                    if (_.isUndefined(childView)) {
                        // the model isn't in our list, oh noes!
                        app.vent.trigger('showNothing');
                    } else {
                        app.State.featureSelected = childModel;
                        childView.expand();
                        app.vent.trigger('showItem:' + childModel.get('type').toLowerCase(), childModel);
                    }
                }
            } else {
                // restore expanded state
                childView.expand();
                app.vent.trigger('showItem:' + childView.model.get('type').toLowerCase(), childView.model);
            }
        }
    },

    onRender: function() {
        this.restoreExpanded();
    },
    
    onClose: function() {
        this.children.each(function(view) {
            view.close();
        });
    }
	
});

// view for features tab (2-columns)
app.views.FeaturesTabView = Backbone.Marionette.LayoutView.extend({
	template: '#template-features-view',
	
    regions: {
        //Column Headings
        colhead1: '#colhead1',
        colhead2: '#colhead2',

        //Column content
        col1: '#col1',
        col2: {
            selector: '#col2',
            regionType: app.views.HideableRegion
        },
    },
	
    initialize: function() {
    	this.template = Handlebars.compile($(this.template).html());
    },
    
    onClose: function() {
    	this.stopListening();
    },
    
    onRender: function() {
        try {
            this.colhead1.close();
            this.col1.close();
            this.col2.close();
        } catch (err) { 
        	
        }
    	var headerView = new app.views.FeaturesHeaderView({
    	});
    	this.colhead1.show(headerView);
    	app.psv = this;
    	//create a sub view that shows all features 
    	//and show on col1 (this.col1.show(subview)) <-- see planner PlanSequenceView.
    },
});


app.views.makeExpandable = function(view, expandClass) {
    /*
     * Call this on a view to indicate it is a expandable item in the three-column layout.
     * When the view's 'expand' event is triggered, it will display it's chevron and trigger
     * the global 'viewExpanded' event.  On recieving a global 'viewExpoanded' event with an
     * expandClass that matches its own, the view will remove it's chevron.
     */
    if (app.currentTab != 'sequence') {
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


app.views.FancyTreeView = Backbone.View.extend({
    initialize: function() {
        this.listenTo(app.vent, 'refreshTree', function() {this.refreshTree()});
        var source = $(this.template).html();
        if (_.isUndefined(source))
            this.template = function() {
                return '';
            };
        else {
            this.template = Handlebars.compile(source);
        }
        _.bindAll(this, 'render', 'afterRender'); 
        var _this = this; 
        this.render = _.wrap(this.render, function(render) { 
            render(); 
            _this.afterRender(); 
            return _this; 
        }); 
    },
    template: '#template-layer-tree',
    render: function() {
        this.$el.html(this.template());
    },
    afterRender: function() {
        app.vent.trigger('layerView:onRender');
        if (!_.isUndefined(app.tree)) {
            // only remove if it's there in the first place
            return;
        }
        var layertreeNode = $("#layertree");
        this.createTree();
        return;
    },
    refreshTree: function() {
        if (!_.isUndefined(app.tree)){
            app.tree.reload({
                url: app.options.layerFeedUrl
            }).done(function(){
                //TODO implement
                app.vent.trigger('layerView:reloadKmlLayers');
            });
        }
    },
    createTree: function() {
        if (_.isUndefined(app.tree)){
            var layertreeNode = $("#layertree");
//            layertreeNode.detach();
//            $("#layertreeContainer").append(layertreeNode);
//            layertreeNode = $("#layertree");
            var mytree = layertreeNode.fancytree({
                extensions: ["persist"],
                source: app.treeData,
                checkbox: true,
                select: function(event, data) {
                    if (_.isUndefined(data.node.kmlLayerView)) {
                        // make a new one
                        app.vent.trigger('kmlNode:create', data.node);
                    } else {
                        data.node.kmlLayerView.render();
                    }
                  },
                  persist: {
                      // Available options with their default:
                      cookieDelimiter: "~",    // character used to join key strings
                      cookiePrefix: undefined, // 'fancytree-<treeId>-' by default
                      cookie: { // settings passed to jquery.cookie plugin
                        raw: false,
                        expires: "",
                        path: "",
                        domain: "",
                        secure: false
                      },
                      expandLazy: false, // true: recursively expand and load lazy nodes
                      overrideSource: true,  // true: cookie takes precedence over `source` data attributes.
                      store: "auto",     // 'cookie': use cookie, 'local': use localStore, 'session': use sessionStore
                      types: "active expanded focus selected"  // which status types to store
                    }
            });
            app.tree = layertreeNode.fancytree("getTree");
            app.vent.trigger('tree:loaded');
        }
    }
    
});


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
    	'layers': app.views.LayersView,
    	'info': app.views.LayerInfoTabView,
    	'features': app.views.FeaturesTabView
    },

    initialize: function() {
        this.on('tabSelected', this.setTab);
        this.listenTo(app.vent, 'setTabRequested', function(tabId) {
            this.setTab(tabId);
        });
    },

    onRender: function() {
        if (! this.options.initialTab) {
            this.options.initialTab = 'meta';
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
        if (! viewClass) {
        	console.log("there is no view class found");
        	return undefined; 
        }

        var view = new viewClass({ /* TODO: later set the view's model here.*/});
        this.tabContent.show(view);

        app.vent.trigger('tab:change', tabId);
    }
});
