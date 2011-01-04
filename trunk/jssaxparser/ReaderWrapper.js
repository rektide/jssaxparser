/*global window, ReaderWrapper */
/*
Copyright or © or Copr. Nicolas Debeissat, Brett Zamir

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
function ReaderWrapper(reader) {
    this.reader = reader;
    this.peeked = [];
}

/*
consumes first char of peeked array, of consumes next char of Reader
*/
ReaderWrapper.prototype.next = function () {
    if (this.peeked.length !== 0) {
         return this.peeked.shift();
    }
    return this.reader.read();
};

/*
read next char without consuming it
if peeked is not empty take the first one
else take next char of Reader and keep it in peeked
*/
ReaderWrapper.prototype.peek = function () {
    if (this.peeked.length !== 0) {
         return this.peeked[0];
    }
    var returned = this.reader.read();
    this.peeked.push(returned);
    return returned;
};

ReaderWrapper.prototype.peekLen = function (len) {
    var returned = "", i, j;
    for (i = 0 ; i < this.peeked.length ; i++) {
        returned += this.peeked[i];
    }
    len -= i;
    returned += this.reader.read(returned, 0, len);
    for(j = 0 ; j < len ; j++) {
         this.peeked.push(returned.charAt(j));
    }
    return returned;
}

ReaderWrapper.prototype.mark = function() {
    this.reader.mark();
};

ReaderWrapper.prototype.reset = function() {
    this.reader.reset();
};

ReaderWrapper.prototype.skip = function (n) {
    for (var i = 0 ; this.peeked.length !== 0 && i < n; i++) {
        this.peeked.shift();
    }
    n -= i;
    this.reader.skip(n);
};

//inspired from java.io.PushbackReader
ReaderWrapper.prototype.unread = function (str) { // long
    for(var i = 0 ; i < str.length ; i++) {
        this.peeked.push(str.charAt(i));
    }
};

