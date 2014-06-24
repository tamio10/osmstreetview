"use strict"
function MapLayer(gl, position) {
    
	//compile and link shader program
	var vertexShader   = glu.compileShader( document.getElementById("shader-vs").text, gl.VERTEX_SHADER);
	var fragmentShader = glu.compileShader( document.getElementById("texture-shader-fs").text, gl.FRAGMENT_SHADER);
	this.shaderProgram  = glu.createProgram( vertexShader, fragmentShader);
	gl.useProgram(this.shaderProgram);   //    Install the program as part of the current rendering state

    //get location of variables in shader program (to later bind them to values);
	this.shaderProgram.vertexPosAttribLocation =   gl.getAttribLocation( this.shaderProgram, "vertexPosition"); 
	this.shaderProgram.texCoordAttribLocation =    gl.getAttribLocation( this.shaderProgram, "vertexTexCoords"); 
    this.shaderProgram.modelViewProjectionMatrixLocation =   gl.getUniformLocation(this.shaderProgram, "modelViewProjectionMatrix")
	this.shaderProgram.texLocation =               gl.getUniformLocation(this.shaderProgram, "tex");
    
    this.createTileHierarchy(  );

}

MapLayer.MIN_ZOOM = 12; //experimentally tested: everything beyond level 12 is beyond the far plane
MapLayer.MAX_ZOOM = 19;

MapLayer.prototype.renderRecursive = function(tileX, tileY, level, maxDistance, hasRenderedParent, tileListOut)
{
    var px = long2tile(position.lng,level);    
    var py = lat2tile( position.lat,level);

    var earthCircumference = 2 * Math.PI * (6378.1 * 1000);
    var physicalTileLength = earthCircumference* Math.cos(position.lat/180*Math.PI) / Math.pow(2, level);
    
    var x1 = (tileX - px)     * physicalTileLength;
    var x2 = (tileX - px + 1) * physicalTileLength;
    
    var y1 = (tileY - py) * physicalTileLength;
    var y2 = (tileY - py + 1) * physicalTileLength
    
    var v1 = [ x1, y1, 0 ];
    var v2 = [ x2, y1, 0 ];
    var v3 = [ x2, y2, 0 ];
    var v4 = [ x1, y2, 0 ];
    
    var minDistance = getMinDistanceFromOrigin(x1, x2, y1, y2);

    if (minDistance  < maxDistance[level] || !hasRenderedParent)
    {
        tileListOut.push( [[v1,v2,v3,v4], tileX, tileY, level]);

        if (level+1 < MapLayer.MAX_ZOOM)
        {
            this.renderRecursive( tileX*2,   tileY*2,   level + 1, maxDistance, true, tileListOut);
            this.renderRecursive( tileX*2+1, tileY*2,   level + 1, maxDistance, true, tileListOut);
            this.renderRecursive( tileX*2,   tileY*2+1, level + 1, maxDistance, true, tileListOut);
            this.renderRecursive( tileX*2+1, tileY*2+1, level + 1, maxDistance, true, tileListOut);
        }
    }
    
}

function getRadius(pixelLength, height)
{
    //assumptions:  
    var vFOV = 45 /180 * Math.PI; // vertical FOV is 45°
    var vView = 768; // vertical viewport size is ~ 1000px on screen --> full sphere (360°) would be ~8000px
    var vCircle = 2*Math.PI /vFOV * vView; //length of circumference of a circle/sphere centered at the eye position in screen pixels

    var anglePerPixel = vFOV/vView; // angle per pixel
    
    
    //initial test: for high camera positions, tiles would be too small already at radius 0.0
    var alpha = Math.atan(pixelLength/height);
    if (alpha < anglePerPixel)
        return 0;
    
    
    var minR = 0;
    var maxR = 100000;
    
    for (var i = 0; i < 100; i++)
    {
        var midR = (minR + maxR) / 2.0;
        
        var edge1 = Math.sqrt( height*height + midR*midR);
        var edge2 = Math.sqrt( height*height + (midR+pixelLength)*(midR+pixelLength) );
        var cosAlpha = -(pixelLength*pixelLength - edge1*edge1 - edge2*edge2)/(2*edge1*edge2); //law of cosines

        // computation of cosAlpha is numerically unstable, may compute values slightly above 1.0.
        // this would result in a cosAlpha of NaN, which screws up comparisons to that value
        if (cosAlpha > 1.0) 
            cosAlpha = 1.0;
            
        var alpha = Math.acos(cosAlpha);

        if (alpha < anglePerPixel)
            maxR = midR;
        else
            minR = midR;
    }
    
    return midR;
}


MapLayer.prototype.createTileHierarchy = function()
{
    var height = eye[2];
    var earthCircumference = 2 * Math.PI * (6378.1 * 1000);
    var physicalTileLength = earthCircumference* Math.cos(position.lat/180*Math.PI) / Math.pow(2, 17);
    var pixelLength = physicalTileLength / 256;
    
    var maxDistance = {};
    
    for (var level = 0; level < 25; level++)
    {
        var physicalTileLength = earthCircumference* Math.cos(position.lat/180*Math.PI) / Math.pow(2, level);
        var pixelLength = physicalTileLength / 256;
        maxDistance[level] = getRadius(pixelLength, height);
    }

    var x = long2tile(position.lng,12);
    var y = lat2tile( position.lat,12);
    
    var listX = x % 1 > 0.5 ? [0, 1] : [-1, 0];
    var listY = y % 1 > 0.5 ? [0, 1] : [-1, 0];
    
    x = Math.floor(x);
    y = Math.floor(y);
    
    var tileList = [];
    for (var i in listX)
        for (var j in listY)
            this.renderRecursive(x+listX[i], y+listY[j], 12, maxDistance, false, tileList);  
    
    /*this.renderRecursive(x+1, y-1, 12, maxDistance, false, tileList);
    this.renderRecursive(x  , y-1, 12, maxDistance, false, tileList);
    this.renderRecursive(x-1, y-1, 12, maxDistance, false, tileList);

    this.renderRecursive(x+1, y,   12, maxDistance, false, tileList);
    this.renderRecursive(x  , y,   12, maxDistance, false, tileList);
    this.renderRecursive(x-1, y,   12, maxDistance, false, tileList);

    this.renderRecursive(x+1, y+1, 12, maxDistance, false, tileList);
    this.renderRecursive(x  , y+1, 12, maxDistance, false, tileList);
    this.renderRecursive(x-1, y+1, 12, maxDistance, false, tileList);*/


    console.log("map layer consists of %s tiles:", tileList.length);
    this.tiles = [];
    for (var i in tileList)
        this.tiles.push(new Tile(tileList[i][1], tileList[i][2], tileList[i][3], this.shaderProgram, this ));
}

MapLayer.prototype.render = function(modelViewMatrix, projectionMatrix) 
{
    for (var i in this.tiles)
        this.tiles[i].render(modelViewMatrix, projectionMatrix);
}
