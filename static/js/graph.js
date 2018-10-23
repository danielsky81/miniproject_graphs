// To load contents from a CSV file we'll use queue.js library
// defer method takes two arguments
    // first - format of the data 
    // second - path to the file
// than we call the await method which takes one argument
    // which is the name of a function we want to call when
    // the data has been downloaded

queue()
    .defer(d3.csv, "data/Salaries.csv")
    .await(makeGraphs);

// we declare this function and it takes two arguments
    // error
    // variable into which data from CSV will be passes by queue.js

function makeGraphs(error, salaryData) {
    var ndx = crossfilter(salaryData);

    salaryData.forEach(function(d){
        d.salary = parseInt(d.salary);
        d.yrs_since_phd = parseInt(d["yrs.since.phd"]);
        d.yrs_service = parseInt(d["yrs.service"]);     // "string" convertion to number
    });

// We pass the ndx variable the crossfilter to the function that's going to draw a graph
// and we can call this function anything we want 

    show_discipline_selector(ndx);
    show_percent_that_are_professors(ndx, "Female", "#percent-of-women-professors");    // (ndx, gender, element)
    show_percent_that_are_professors(ndx, "Male", "#percent-of-men-professors");        // (ndx, gender, element)
    show_gender_balance(ndx);
    show_average_salaries(ndx);
    show_rank_distribution(ndx);
    show_service_to_salary_correlation(ndx);
    show_phd_to_salary_correlation(ndx);

    dc.renderAll();
}

// Drop down menu selection

function show_discipline_selector(ndx) {
    var disciplineDim = ndx.dimension(dc.pluck("discipline"));
    var disciplineSelect = disciplineDim.group();

    dc.selectMenu("#discipline-selector")
        .dimension(disciplineDim)
        .group(disciplineSelect);
}


function show_percent_that_are_professors(ndx, gender, element) {
    var percentageThatAreProf = ndx.groupAll().reduce(
        function (p, v) {
            if (v.sex === gender) {
                p.count++;
                if (v.rank === "Prof") {
                   p.are_prof++;
                }
            }
            return p;
        },
        function (p, v) {
            if (v.sex === gender) {
                p.count--;
                if (v.rank === "Prof") {
                   p.are_prof--;
                }
            }
            return p;
        },
        function () {
            return {count: 0, are_prof: 0};
        }
    );

    dc.numberDisplay(element)
        .formatNumber(d3.format(".2%"))
        .valueAccessor(function (d) {
            if (d.count == 0) {
                return 0;
            } else {
                return (d.are_prof / d.count);
            }
        })
        .group(percentageThatAreProf);
}

// We write this function and it takes one argument "ndx"
// Inside the function we can focus on one graph
    // Inside the function we can use the ndx variable the crossfilter to create our dimension
    // we'll also create a group and we're just going to count the rows in the data 

function show_gender_balance(ndx) {
    var genderDim = ndx.dimension(dc.pluck("sex"));
    var genderMix = genderDim.group();

    dc.barChart("#gender-balance")
        .width(350)
        .height(250)
        .margins({top: 10, right: 50, bottom: 30, left: 50})
        .dimension(genderDim)
        .group(genderMix)
        .transitionDuration(500)
        .x(d3.scale.ordinal())
        .xUnits(dc.units.ordinal)
        .elasticY(true)
        .xAxisLabel("Gender")
        .yAxis().ticks(20);
}

// Dimension for this bar chart is going to be the sex column
// but the group needs to be created using a custom "reducer" that will calculate
// the average salary for men and for women.

function show_average_salaries(ndx) {
    var genderDim = ndx.dimension(dc.pluck("sex"));

    // we need to pass to the reduce function three functions which you've seen before:
        // an initializer, a function for adding data items and a function for removing data items.
    // The add item takes two arguments P and V.
        // P is an accumulator that keeps track of the total the count and the average
        // V represents each of the data items that we're adding or removing

    var averageSalaryByGender = genderDim.group().reduce(
        function (p, v) {           // function add
            p.count++;              // increment count
            p.total += v.salary;    
            return p;
        },
        function (p, v) {           // function remove
            p.count--;              // reduce count
            if (p.count == 0) {     // "if statement" to avoid count = 0 
                p.total = 0;
            } else {
                p.total -= v.salary;    // reduce total
            }
            return p;
        },
        function () {               // function initialise
            return {count: 0, total: 0};
        }
    );

    dc.barChart("#average-salary")
        .width(350)
        .height(250)
        .margins({top: 10, right: 50, bottom: 30, left: 50})
        .dimension(genderDim)
        .group(averageSalaryByGender)
        .valueAccessor(function (d) {       // to specify which values get plottered (average here)
            if (d.value.count == 0) {
                return 0;
            } else {
                return d.value.total / d.value.count;
            }
        })
        .transitionDuration(500)
        .x(d3.scale.ordinal())
        .xUnits(dc.units.ordinal)
        .elasticY(true)
        .xAxisLabel("Gender")
        .yAxis().ticks(4);
}


function show_rank_distribution(ndx) {

    function rankByGender(dimension, rank) {
        return dimension.group().reduce(
            function (p, v) {       // we will always increment total but will only increment
                p.total++;          // match if the rank of the piece of data we're looking at is professor, etc
                if (v.rank === rank) {
                    p.match++;
                };
                return p;
            },
            function (p, v) {
                p.total--;
                if (v.rank === rank) {
                    p.match--;
                };
                return p;
            },
            function () {
                return { total: 0, match: 0 }

    // our initialized functions data structure will contain "total" which will be an
    // accumulator or a count for the number of rows that we're dealing with
    // and "match" will be the count of how many of those rows are professors, etc

            }
        );
    };

    var dim = ndx.dimension(dc.pluck("sex"));
    var profByGender = rankByGender(dim, "Prof");
    var asstProfByGender = rankByGender(dim, "AsstProf");
    var assocProfByGender = rankByGender(dim, "AssocProf");
    
    dc.barChart("#rank-distribution")
        .width(350)
        .height(250)
        .dimension(dim)
        .group(profByGender, "Prof")
        .stack(asstProfByGender, "AsstProf")        // stacked groups
        .stack(assocProfByGender, "AssocProf")
        .valueAccessor(function (d) {               // needed as we used custom reducer
            if(d.value.total > 0) {
                return (d.value.match / d.value.total) * 100
            } else {
                return 0;
            }
            return d.value.percent * 100;
        })
        .x(d3.scale.ordinal())
        .xUnits(dc.units.ordinal)
        .xAxisLabel("Gender")
        .legend(dc.legend().x(270).y(170).itemHeight(15).gap(5))
        .margins({top: 10, right: 100, bottom: 30, left: 30});
}


function show_service_to_salary_correlation(ndx) {
    var genderColors = d3.scale.ordinal()
        .domain(["Female", "Male"])
        .range(["pink", "blue"]);

    var eDim = ndx.dimension(dc.pluck("yrs_service"));
    var experienceDim = ndx.dimension(function(d){
        return [d.yrs_service, d.salary, d.rank, d.sex];
    });
    var experienceSalaryGroup = experienceDim.group();

    var minExperience = eDim.bottom(1)[0].yrs_service;
    var maxExperience = eDim.top(1)[0].yrs_service;

    dc.scatterPlot("#service-salary")
        .width(800)
        .height(400)
        .x(d3.scale.linear().domain([minExperience,maxExperience]))
        .brushOn(false)
        .symbolSize(8)
        .clipPadding(10)
        .yAxisLabel("Salary")
        .xAxisLabel("Years Of Service")
        .title(function (d) {
            return d.key[2] + " earned " + d.key[1];
        })
        .colorAccessor(function (d) {
            return d.key[3];        // sex is 4th item in dimension array (line 232)
        })
        .colors(genderColors)
        .dimension(experienceDim)
        .group(experienceSalaryGroup)
        .margins({top: 10, right: 50, bottom: 75, left: 75});
}


function show_phd_to_salary_correlation(ndx) {
    var genderColors = d3.scale.ordinal()
        .domain(["Female", "Male"])
        .range(["pink", "blue"]);

    var pDim = ndx.dimension(dc.pluck("yrs_since_phd"));
    var phdDim = ndx.dimension(function(d){
        return [d.yrs_since_phd, d.salary, d.rank, d.sex];
    });
    var phdSalaryGroup = phdDim.group();

    var minPhd = pDim.bottom(1)[0].yrs_since_phd;
    var maxPhd = pDim.top(1)[0].yrs_since_phd;

    dc.scatterPlot("#phd-salary")
        .width(800)
        .height(400)
        .x(d3.scale.linear().domain([minPhd,maxPhd]))
        .brushOn(false)
        .symbolSize(8)
        .clipPadding(10)
        .yAxisLabel("Salary")
        .xAxisLabel("Years Since PhD")
        .title(function (d) {
            return d.key[2] + " earned " + d.key[2];
        })
        .colorAccessor(function (d) {
            return d.key[3];
        })
        .colors(genderColors)
        .dimension(phdDim)
        .group(phdSalaryGroup)
        .margins({top: 10, right: 50, bottom: 75, left: 75});
}
