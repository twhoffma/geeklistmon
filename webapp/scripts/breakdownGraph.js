angular.module('breakdownDirective', ["highcharts-ng"])
	.controller('breakdownController', ['$scope', function($scope){
		
	}])
	.directive('breakdownGraph', ['$document', function($document){
		function link(scope, element, attrs){
			var series = [];
			var levels = [];
			var levelLabels = [];
			
			/** Controls the given level of drilldown and lauches drilldown */
			function listDrilldown(conf, e){
				if(levels.indexOf(e.point.id) === -1){
					levels.push(e.point.id);
					levelLabels.push(e.point.name);
				}
				
				nm = "Given "+levelLabels.join(">");
				drilldownSeries = decomposeListConditional(scope.boardgames, property, levels)

				conf.options.drilldown.series = [{id: e.point.id, name: nm, data: drilldownSeries}];
			}
			
			/** Check that boardgame[property] contains all property ids in given*/
			function containsAll(boardgame, property, given){
				num = 0;
					
				given.forEach(
					function(p){
						b =boardgame[property].find(
							function(pr){
								return(pr.id === p);
							}
						);
						if(b != undefined){
							num++;
						}
					}
				); 
													
				return(num == given.length);
			}
			
			/** drilldown given certain property id's */
			function decomposeListConditional(boardgames, property, given){
				console.log("Run decompose conditional" + given.join(">"));
				items = [];
				series = [];
				
				if(scope.boardgames != undefined){
					//First filter out games that have all the things we are drilling down on.
					var bgList = boardgames.filter(function(boardgame) {return containsAll(boardgame, property, given)});
	
					bgList.forEach(function(boardgame){
						//TODO: Add item "no other mechanics/categories" to see the ones that only have the drilldown categories.
						boardgame[property].forEach(function(i){
							if(given.indexOf(i.id) === -1){
								item = items.find(function(j){ return(j.id === i.id);});
								
								if(item === undefined){
									item = {'id': i.id, 'name': i.name, 'cnt': 0};
									items[items.length] = item;
								}	
								
								item.cnt += 1;
							}
						});
					});
					
					items.forEach(function(i){
						series.push({name: i.name, y: i.cnt, drilldown: true, id: i.id});
					});
					
					series.sort(function(a,b){
						if(a.y > b.y){
							return(-1)
						}else{
							return(1)
						}
					});	
				}
			
				return(series);	
			}				

			scope.chartConfig = {
				options: {
					chart: {
						type: 'pie',
						events: {
							drilldown: function(e){scope.$apply(listDrilldown(this, e));},
							drillup: function(e) {levels.pop(); levelLabels.pop();},
							click: function() {
								scope.$apply(function () {
									alert('click!');
								});
							}	
						}
					}
				},
				title: {
					text: scope.property + ' breakdown'
				},
				size: {},
				drilldown: {series: [{}]},
				series: []
			};

			scope.$watch('boardgames', function(e){
				scope.chartConfig.series = [{name: scope.property + ' breakdown', data: decomposeListConditional(scope.boardgames, scope.property, []), type: 'pie'}];
			});

			element.on('click', function(e){
				alert("click!");
				element.trigger('click');
			});

			scope.clicked = function(){
				alert("clicked!");
			}
		}
		

		return {
			restrict: 'E',
            replace: true,
			scope: {
				property: '@prop',
				boardgames: '=boardgames'
			},
			template: '<div><highchart config="chartConfig" ng-click="clicked"></highchart>',
			link : link
		};
	}]);
