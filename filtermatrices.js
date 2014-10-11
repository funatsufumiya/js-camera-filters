'use strict';

$(function() {

var video = document.querySelector("#vid");
var canvas = document.querySelector('#canvas');
var context = canvas.getContext('2d');
var localMediaStream = null;
var isSimpleMatrix = false;
var $userMatrix = $('#usermatrix');

$(function() {

    // true if the given string represents a valid matrix
    var isValidMatrix = function(matrixString) {
        try {
            return Array.isArray(JSON.parse(matrixString));
        } catch (e) {
            return false;
        }
    }

    // if the matrix is changed, update mode to 'custom'
    // also check whether the input is a valid matrix
    $userMatrix.bind('input propertychange', function() {
        isSimpleMatrix = true;
        $('#filter').val('custom').change();

        if (!isValidMatrix($userMatrix.val())) {
            $userMatrix.addClass('invalidmatrix');
        } else {
            $userMatrix.removeClass('invalidmatrix');
        }
    });


    var simpleMatrices = {
        'prewitt-x': '[[-1,0,1],[-1,0,1],[-1,0,1]]',
        'prewitt-y': '[[-1,-1,-1],[0,0,0],[1,1,1]]',
        'prewitt-y-switched': '[[1,1,1],[0,0,0],[-1,-1,-1]]',
        'sobel-x': '[[1,0,-1],[2,0,-2],[1,0,-1]]',
        'sobel-y': '[[1,2,1],[0,0,0],[-1,-2,-1]]',
        'kirsch-x': '[[5,-3,-3],[5,0,-3],[5,-3,-3]]',
        'kirsch-y': '[[5,5,5],[-3,0,-3],[-3,-3,-3]]',
        'laplace': '[[0,1,0],[1,-4,1],[0,1,0]]',
        'gauss': '[[2.0/159,4.0/159,5.0/159,4.0/159,2.0/159],[4.0/159,9.0/159,12.0/159,9.0/159,4.0/159],[5.0/159,12.0/159,15.0/159,12.0/159,5.0/159],[4.0/159,9.0/159,12.0/159,9.0/159,4.0/159],[2.0/159,4.0/159,5.0/159,4.0/159,2.0/159]]',
        'LoG': '[[0,0,0,-1,0,0],[0,-1,-2,-1,0,0],[-1,-2,16,-2,-1,0],[0,-1,-2,-1,0,0],[0,0,0,-1,0,0]]',
        'custom': '[[1]]',
        'emboss': '[[-1,-1,0],[-1,1,1],[0,1,1]]'
    };

    var combinedMatrices = {
        'prewitt': [ JSON.parse(simpleMatrices['prewitt-x']), JSON.parse(simpleMatrices['prewitt-y']) ],
        'sobel': [ JSON.parse(simpleMatrices['sobel-x']), JSON.parse(simpleMatrices['sobel-y']) ],
        'kirsch': [ JSON.parse(simpleMatrices['kirsch-x']), JSON.parse(simpleMatrices['kirsch-y']) ],
    };


    var activeCombinedMatrix = combinedMatrices['sobel'];

    $('#filter').change(function() {
        var opt = $(this).find(":selected");
        var optGroup = opt.parent().attr('id');
        var name = opt.attr('value');

        if (optGroup === 'filters-simple') {
            isSimpleMatrix = true;
            var matrixFormatted = simpleMatrices[name];//.replace('],', '],\n');
            $userMatrix.text(matrixFormatted);
            $userMatrix.removeClass('disabled');
        } else {
            isSimpleMatrix = false;
            activeCombinedMatrix = combinedMatrices[name];
            $userMatrix.text('apply filter-x to each pixel x\napply filter-y to each pixel y\nThe final pixel color then is sqrt(x^2 + y^2)');
            $userMatrix.addClass('disabled');

        }
    });
    $('#filter').val('prewitt').change();


    function combinedFilter(matrix1, matrix2, x, y, imgData, imgDataNormal) {
        var pixel1 = 0;
        var pixel2 = 0;
        for (var ym=0; ym < matrix1.length; ym++) {
            for (var xm=0; xm < matrix1[0].length; xm++) {
                var tmpYPos = y+(-matrix1.length+ym);
                var tmpXPos = x+(-matrix1[0].length+xm);
                var tmpPos = 4*(imgData.width*tmpYPos+tmpXPos);
                pixel1 += matrix1[ym][xm]*imgDataNormal.data[tmpPos];
            }
        }

        if (matrix1 == matrix2) {
            return pixel1;
        }

        for (var ym = 0; ym < matrix2.length; ym++) {
            for (var xm = 0; xm < matrix2[0].length; xm++) {
                var tmpYPos = y + (-matrix2.length + ym);
                var tmpXPos = x + (-matrix2[0].length + xm);
                var tmpPos = 4 * (imgData.width * tmpYPos + tmpXPos);
                pixel2 += matrix2[ym][xm] * imgDataNormal.data[tmpPos];
            }
        }

        return Math.sqrt(pixel1*pixel1 + pixel2*pixel2);
    }

    /**
     * Apply a filter to grayscale image. (Covolution)
     * @param {ImageData} imgData 
     * @param {matrix of numbers} matrix
     * @return {undefined}
     */
    function applyMatrix(imgData, matrix1, matrix2) {
        var imgDataNormal = context.getImageData(0, 0, context.canvas.width, context.canvas.height);
        var sep = (matrix1.length-1)/2

        for (var i = 0; i < imgData.width * imgData.height * 4; i += 4) {
            var tmp = i/4;
            var x = tmp % imgData.width;
            var y = (tmp - x)/imgData.width;
            if (x <= sep || y <= sep) {
                // too small to apply filter
                continue;
            }

            var color = combinedFilter(matrix1, matrix2, x, y, imgData, imgDataNormal);
            imgData.data[4*(imgData.width*y+x)+0] = color; // r
            imgData.data[4*(imgData.width*y+x)+1] = color; // g
            imgData.data[4*(imgData.width*y+x)+2] = color; // b
        }
        context.putImageData(imgData, 0, 0);
    }


    setInterval(function snapshot() {
        if (localMediaStream) {
            context.drawImage(video, 0, 0);
            var width = 640;
            var height = 480;
            var imgDataNormal = context.getImageData(0, 0, width, height);
            var imgData = context.createImageData(width, height);

            for (var i = 0; i < imgData.width * imgData.height * 4; i += 4) {
                var r = (imgDataNormal.data[i + 0] * .393) + (imgDataNormal.data[i + 1] * .769) + (imgDataNormal.data[i + 2] * .189);
                var g = (imgDataNormal.data[i + 0] * .349) + (imgDataNormal.data[i + 1] * .686) + (imgDataNormal.data[i + 2] * .168);
                var b = (imgDataNormal.data[i + 0] * .272) + (imgDataNormal.data[i + 1] * .534) + (imgDataNormal.data[i + 2] * .131);
                if (r > 255) {
                    r = 255;
                }
                if (g > 255) {
                    g = 255;
                }
                if (b > 255) {
                    b = 255;
                }
                imgData.data[i + 0] = r;
                imgData.data[i + 1] = g;
                imgData.data[i + 2] = b;
                imgData.data[i + 3] = imgDataNormal.data[i + 3];

                // Grayscale
                var brightness = (3*r+4*g+b)>>>3;
                imgData.data[i] = brightness;
                imgData.data[i+1] = brightness;
                imgData.data[i+2] = brightness;
            }
            


            context.putImageData(imgData, 0, 0);
            if (isSimpleMatrix) {
                if (isValidMatrix($userMatrix.val())) {
                    var matrix = eval($userMatrix.val());
                    applyMatrix(imgData, matrix, matrix);
                }
            } else {
                var matrix1 = activeCombinedMatrix[0];
                var matrix2 = activeCombinedMatrix[1];
                applyMatrix(imgData, matrix1, matrix2);
            }

            
        }
    }, 20);


});

var onCameraFail = function (e) {
    console.log('Camera did not work.', e);
};


navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
window.URL = window.URL || window.webkitURL;
navigator.getUserMedia({video:true}, function (stream) {
    video.src = window.URL.createObjectURL(stream);
    localMediaStream = stream;
}, onCameraFail);

});
