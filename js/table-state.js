(function($){
  // Serialize the table state into a query string (pg, pageSize, sort, order, search, and per-column filters)
  function serializeTableState(){
    var $table = $('#catalog-table');
    var opts = $table.bootstrapTable('getOptions') || {};
    var params = new URLSearchParams();

    if (opts.pageNumber) params.set('pg', opts.pageNumber);
    if (opts.pageSize) params.set('pageSize', opts.pageSize);
    if (opts.sortName) params.set('sort', opts.sortName);
    if (opts.sortOrder) params.set('order', opts.sortOrder);
    // bootstrap-table recent versions store search text in options.searchText
    if (opts.searchText) params.set('search', opts.searchText);

    // capture per-column filter inputs (we use class .column-filter and data-field)
    $table.find('.column-filter').each(function(){
      var field = $(this).data('field');
      if (!field) return;
      var val = $(this).val();
      if (val !== undefined && val !== null && String(val).length) {
        params.set('f_' + field, val);
      }
    });

    return params.toString(); // already URL-encoded
  }

  // Attach the serialized state to all image links in the table (links should use class 'image-link')
  function attachStateToImageLinks(){
    var qs = serializeTableState();
    $('#catalog-table').find('a.image-link').each(function(){
      var $a = $(this);
      // Keep a base href without any previous state to avoid appending multiple qstrings
      var hrefBase = $a.data('href-base');
      if (!hrefBase) {
        var original = $a.attr('href') || '';
        // store the href up to the first '?' (base)
        hrefBase = original.split('?')[0];
        $a.data('href-base', hrefBase);
      }
      var separator = hrefBase.indexOf('?') === -1 ? '?' : '&';
      var newHref = hrefBase + (qs ? separator + qs : '');
      $a.attr('href', newHref);
    });
  }

  // Restore table state from URL parameters on page load
  function restoreTableStateFromUrl(){
    var params = new URLSearchParams(window.location.search);

    var page = params.get('pg');
    var pageSize = params.get('pageSize');
    var sort = params.get('sort');
    var order = params.get('order');
    var search = params.get('search');

    // restore column filters (inputs should have data-field set)
    $('#catalog-table').find('.column-filter').each(function(){
      var field = $(this).data('field');
      if (!field) return;
      var val = params.get('f_' + field);
      if (val !== null) {
        $(this).val(val);
      }
    });

    // Trigger change on filter inputs so existing handlers run and re-filter the table
    $('#catalog-table').find('.column-filter').trigger('change');

    // Restore search text early (so table initial load can use it)
    if (search) {
      $('#catalog-table').bootstrapTable('refreshOptions', { searchText: search });
    }

    // Restore pagination/sort using refreshOptions
    var opts = {};
    if (page) opts.pageNumber = parseInt(page, 10);
    if (pageSize) opts.pageSize = parseInt(pageSize, 10);
    if (sort) opts.sortName = sort;
    if (order) opts.sortOrder = order;

    if (Object.keys(opts).length) {
      $('#catalog-table').bootstrapTable('refreshOptions', opts);
    }
  }

  // Expose helpers globally and wire up events
  $(function(){
    // Keep links in sync whenever table events that change state happen
    $('#catalog-table').on('page-change.bs.table sort.bs.table search.bs.table load-success.bs.table post-body.bs.table', attachStateToImageLinks);

    // Also update when custom filter inputs change
    $(document).on('input change', '#catalog-table .column-filter', attachStateToImageLinks);

    // initial attach (in case image links were rendered immediately)
    attachStateToImageLinks();

    // restore state from URL if there is any
    restoreTableStateFromUrl();

    // expose for use inside imageFormatter if desired
    window.serializeTableState = serializeTableState;
    window.attachStateToImageLinks = attachStateToImageLinks;
    window.restoreTableStateFromUrl = restoreTableStateFromUrl;
  });

})(jQuery);
