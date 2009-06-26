/*global ActiveXObject, XSLTProcessor, window, xsltProcessor, createDocumentFromText, innerXML, XMLHttpRequest, alert, document, navigator */
/*
Copyright or © or Copr. Nicolas Debeissat

nicolas.debeissat@gmail.com (http://debeissat.nicolas.free.fr/) brettz9@yahoo.com

This software is a computer program whose purpose is to parse XML
files respecting SAX2 specifications.

This software is governed by the CeCILL license under French law and
abiding by the rules of distribution of free software. You can use,
modify and/ or redistribute the software under the terms of the CeCILL
license as circulated by CEA, CNRS and INRIA at the following URL
"http://www.cecill.info".

As a counterpart to the access to the source code and rights to copy,
modify and redistribute granted by the license, users are provided only
with a limited warranty and the software's author, the holder of the
economic rights, and the successive licensors have only limited
liability.

In this respect, the user's attention is drawn to the risks associated
with loading, using, modifying and/or developing or reproducing the
software by the user in light of its specific status of free software,
that may mean that it is complicated to manipulate, and that also
therefore means that it is reserved for developers and experienced
professionals having in-depth computer knowledge. Users are therefore
encouraged to load and test the software's suitability as regards their
requirements in conditions enabling the security of their systems and/or
data to be ensured and, more generally, to use and operate it in the
same conditions as regards security.

The fact that you are presently reading this means that you have had
knowledge of the CeCILL license and that you accept its terms.

*/
/* sax 2 methods
 void 	attributeDecl(java.lang.String eName, java.lang.String aName, java.lang.String type, java.lang.String mode, java.lang.String value)
          Report an attribute type declaration.
 void 	comment(char[] ch, int start, int length)
          Report an XML comment anywhere in the document.
 void 	elementDecl(java.lang.String name, java.lang.String model)
          Report an element type declaration.
 void 	endCDATA()
          Report the end of a CDATA section.
 void 	endDTD()
          Report the end of DTD declarations.
 void 	endEntity(java.lang.String name)
          Report the end of an entity.
 void 	externalEntityDecl(java.lang.String name, java.lang.String publicId, java.lang.String systemId)
          Report a parsed external entity declaration.
 InputSource 	getExternalSubset(java.lang.String name, java.lang.String baseURI)
          Tells the parser that if no external subset has been declared in the document text, none should be used.
 void 	internalEntityDecl(java.lang.String name, java.lang.String value)
          Report an internal entity declaration.
 InputSource 	resolveEntity(java.lang.String publicId, java.lang.String systemId)
          Invokes EntityResolver2.resolveEntity() with null entity name and base URI.
 InputSource 	resolveEntity(java.lang.String name, java.lang.String publicId, java.lang.String baseURI, java.lang.String systemId)
          Tells the parser to resolve the systemId against the baseURI and read the entity text from that resulting absolute URI.
 void 	startCDATA()
          Report the start of a CDATA section.
 void 	startDTD(java.lang.String name, java.lang.String publicId, java.lang.String systemId)
          Report the start of DTD declarations, if any.
 void 	startEntity(java.lang.String name)
          Report the beginning of some internal and external XML entities.
*/

function loadXMLDoc(fname) {
    var xmlDoc;
	//code for safari
	if (/Safari/.test(navigator.userAgent)) {
		var xmlhttp = new XMLHttpRequest();
		xmlhttp.overrideMimeType('text/xml');
		xmlhttp.open('GET', fname, false);
		xmlhttp.send(null);
		if (xmlhttp.readyState === 4) {
			xmlDoc = xmlhttp.responseXML;
		}
	} else {
	    // code for IE
	    if (window.ActiveXObject) {
	        xmlDoc = new ActiveXObject("Microsoft.XMLDOM");
	    }
	    // code for Mozilla, Firefox, Opera, etc.
	    else if (document.implementation && document.implementation.createDocument) {
	        xmlDoc = document.implementation.createDocument(null, "", null);
	    } else {
	        alert('Your browser cannot handle this script');
	    }
	    xmlDoc.async = false;
	    xmlDoc.load(fname);
	}
    return xmlDoc;
}

function loadFile(fname) {
	var xmlhttp = null;
	if (window.XMLHttpRequest) {// code for Firefox, Opera, IE7, etc.
		xmlhttp = new XMLHttpRequest();
	} else if (window.ActiveXObject) {// code for IE6, IE5
		xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");
	}
	if (xmlhttp !== null) {
		xmlhttp.open("GET", fname, false);
		xmlhttp.send(null);
		if (xmlhttp.readyState === 4) {
			return xmlhttp.responseText;
		}
	} else {
		alert("Your browser does not support XMLHTTP.");
	}
    return false;
}

function applyXslt(xml, xsl, asFragment, paramMap) {
    var i;
    // code for IE 
    if (window.ActiveXObject) {
        var xslt = new ActiveXObject("Msxml2.XSLTemplate.3.0" );
		var xslDoc = new ActiveXObject("Msxml2.FreeThreadedDOMDocument.3.0" );
		xslDoc.async = false;
		xslDoc.load(xsl);
		xslt.stylesheet = xslDoc;
		var xslProc = xslt.createProcessor();
		xslProc.input = xml;
		if (paramMap) {
			for (i in paramMap) {
				xslProc.addParameter(i, paramMap[i]);
			}
		}
		xslProc.transform();
		return xslProc.output;
    }
    // code for Mozilla, Firefox, Opera, etc.
    else if (document.implementation && document.implementation.createDocument) {
		xsl = loadXMLDoc(xsl);
        var xsltProcessor = new XSLTProcessor();
        xsltProcessor.importStylesheet(xsl);
		if (paramMap) {
			for (i in paramMap) {
				xsltProcessor.setParameter(null, i, paramMap[i]);
			}
		}
		var resultDocument;
		if (asFragment) {
			resultDocument = xsltProcessor.transformToFragment(xml, document);
		} else {
			resultDocument = xsltProcessor.transformToDocument(xml, document);
		}
        return resultDocument;
    }
    else {
        throw 'Your browser apparently does not support XSLT';
    }
}

function applyXsltOnText(xml, xsl) {
    xml = createDocumentFromText(xml);
	var result = applyXslt(xml, xsl);
    return innerXML(result);
}