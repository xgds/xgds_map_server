app.views.SearchView = Backbone.Marionette.LayoutView.extend({
    template: '#template-search',
    events: {
        'click #getSearchFormButton': 'setupSearchForm',
        'click #doSearch': 'doSearch'
    },
    regions: {
        modelChoiceRegion: '#modelChoiceDiv',
        searchFormRegion: { selector: '#searchFormDiv',
                            regionType: app.views.HideableRegion },
        searchResultsRegion: { selector: '#searchResultsDiv',
                               regionType: app.views.HideableRegion }
    },
    initialize: function() {
        var source = $(this.template).html();
        if (_.isUndefined(source)) {
            this.template = function() {
                return '';
            };
        } else {
            this.template = Handlebars.compile(source);
        }
    },
    onRender: function() {
        var theKeys = Object.keys(app.options.searchModels);
        this.$el.html(this.template({
            searchModels: theKeys
        }));
        this.searchResultsView = new app.views.SearchResultsView({template:'#template-search-results', 
                                                                  region: this.searchResultsRegion})
        this.searchResultsRegion.show(this.searchResultsView);
    },
    setupSearchForm: function() {
        var newModel = this.$("#searchModelSelector").val();
        if (!_.isUndefined(this.selectedModel)){
            if (newModel == this.selectedModel){
                return;
            }
        }
        app.vent.trigger("mapSearch:clear");
        this.searchResultsView.reset();
        this.selectedModel = newModel;
        var templateName = '#template-' + this.selectedModel;
        this.searchFormView = new app.views.SearchFormView({template:templateName})
        this.searchFormRegion.show(this.searchFormView);
        this.$("#form-"+this.selectedModel).on('submit', function(event){
            event.preventDefault();
        });
    },
    doSearch: function() {
        var theForm = this.$("#form-"+this.selectedModel);
        var postData = theForm.serializeArray();
        postData.push({'name':'modelClass', 'value':app.options.searchModels[this.selectedModel].model});
        $.ajax({
            url: '/xgds_map_server/doMapSearch',
            dataType: 'json',
            data: postData,
            success: $.proxy(function(data) {
                app.vent.trigger("mapSearch:found", data);
                this.searchResultsView.updateContents(data);
            }, this),
            error: $.proxy(function(data){
                app.vent.trigger("mapSearch:clear");
                this.showDataError(data);
            }, this)
          });
    },
    clearSearch: function() {
        
    }
});

app.views.SearchFormView = Backbone.Marionette.ItemView.extend({
});

app.views.SearchResultsView = Backbone.Marionette.ItemView.extend({
    initialize: function(options){
        this.region = this.options.region;
    },
    updateContents: function(data) {
        if (data.length > 0){
            if (!_.isUndefined(this.theDataTable)) {
                this.theDataTable.fnClearTable();
                this.theDataTable.fnAddData(data);
            } else {
                var theTable = this.$("#searchResultsTable");
                var columns = Object.keys(data[0]);
                var columnHeaders = columns.map(function(col){
                    return { data: col}
                });
                var dataTableObj = {
                        data: data,
                        columns: columnHeaders,
                        bAutoWidth: true,
                        stateSave: true,
                        bPaginate: true,
                        iDisplayLength: -1, 
                        bLengthChange: true,
                        bSort: true,
                        bJQueryUI: false,
                        sScrollY:  this.calcDataTableHeight(),
                        "lengthMenu": [[10, 20, 40, -1], [10, 20, 40, "All"]],
                        "oLanguage": {
                            "sLengthMenu": "Display _MENU_"
                        }
                }
                this.theDataTable = theTable.dataTable( dataTableObj );
            }
        }
    },
    calcDataTableHeight : function() {
        var h =  Math.floor($(window).height()*.4);
        return h + 'px';
    },
    reset: function() {
        if (!_.isUndefined(this.theDataTable)) {
            this.theDataTable.destroy();
            this.theDataTable = undefined;
        }
    }
});
