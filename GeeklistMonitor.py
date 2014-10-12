import requests
import xml.etree.ElementTree as ET
import json
import sys
import os.path
import time
import pdb
import couchdb
from localconfig import credentials

#1. First load preexisting database or textfile. 
#2. Populate loadedBoardGames list from the result.
#3. For every loaded boardgame, add object to dictionary. 
#4. When extractBoardGames finishes, dump the full dictionary to file.


def extractBoardGames(geeklistIdOrig, geeklistId, loadedLists, loadedBoardGames, glStats, depth):
	geeklistUrl = 'http://www.boardgamegeek.com/xmlapi/geeklist/'
	boardgameUrl = 'http://www.boardgamegeek.com/xmlapi/boardgame/'
	r = requests.get(geeklistUrl + str(geeklistId))
	root = ET.fromstring(r.text.encode('utf-8'))
	rnk = 1
	tot_num = len(root.findall('item'))
	date_key = time.strftime("%Y-%m-%d")
	geeklistTitle = root.find('title')
	#depth 
	depth += 1
	bgCnt = 0
	if depth > glStats["depth"]:
		glStats["depth"] += 1
	for i in root.iter('item'):
		objId = i.attrib['objectid']
		objType = i.attrib['objecttype']
		objSubType = i.attrib['subtype']
		if objSubType == 'boardgame':
			bgCnt += 1
			bg = loadedBoardGames.get(objId)
			if bg is None:
				dbEntry = db.get(objId)
				if dbEntry:
					bg = BoardgameDecoder(dbEntry)
					loadedBoardGames[objId] = bg
					#Count unique boardgame
					glStats["bgCnt"] += 1
			if bg is None:
				bg = boardgame()
				bg.crets = i.attrib['postdate']
				bg.objectid = objId
				bg._id = objId
				loadedBoardGames[objId] = bg
				bg.loadBoardGameGeekInfo()
				bg.reloadAttempt += 1
				print str(bg.objectid) + ": Added"
			if (not bg.isComplete() or reloadStatic) and bg.reloadAttempt == 0 and not reloadNone:
				print str(bg.objectid) + ": Reloading info"
				bg.reloadAttempt += 1
				bg.loadBoardGameGeekInfo()
				#Count unique boardgame
				glStats["bgCnt"] += 1
			#Mark for saving
			bg.updated = True
			geeklist = next((x for x in bg.geeklists if x["id"] == geeklistIdOrig), None)
			if not geeklist:
				print str(bg.objectid) + ": Added geeklist " + geeklistIdOrig
				geeklist = {"id": geeklistIdOrig, "name": geeklistTitle, "stats": []}
				bg.geeklists.append(geeklist)
			stat = next((x for x in geeklist["stats"] if x["date"] == date_key), None)
			if not stat:
				stat = {"date": date_key, "crets": time.strftime("%H:%M:%S"), "obs":[], "cnt":0}
				geeklist["stats"].append(stat)
			obs = next((x for x in stat["obs"] if x["pos"] == str(rnk)), None)
			if not obs:
				obs = {"pos": str(rnk), "cnt": 0}
				stat["obs"].append(obs)
			bg.cnt += 1
			obs["cnt"] += 1
			stat["cnt"] += 1
			rnk += 1
		elif objType == 'geeklist':
			if not objId in loadedLists:
				loadedLists[objId] = True
				extractBoardGames(geeklistIdOrig, objId, loadedLists, loadedBoardGames, glStats, depth)
				#TODO: Count geeklists
				glStats["glCnt"] += 1
	depth -= 1
	bucket = next((x for x in glStats["bgHistogram"] if x["bucketId"] == str(bgCnt)), None)
	if not bucket:
		bucket = {"bucketId": str(bgCnt), 'cnt': 0}
		glStats["bgHistogram"].append(bucket)
	bucket["cnt"] += 1
			
	#TODO: Add num boardgames to dict for geeeklist. Add if not parent geeklist. If parent geeklist calculate num geeklists, avg. length,median length	

class boardgame:
	def __init__(self, e = None):
		self.name = ''
		self.yearpublished = ''
		self.minplayers = ''
		self.maxplayers = ''
		self.crets = ''
		self.playingtime = ''
		self.objectid = ''
		self.cnt = 0
		self.boardgamepublisher = []
		self.boardgamedesigner = []
		self.isExpansion = False
		self.reloadAttempt = 0
		self.thumbnail = ""
		self.boardgamemechanic = []
		self.boardgamecategory = []
		self.geeklists = []
		self._id = None
		self.type = 'boardgame'
		self._rev = None
		self.updated = False
		
		if not e is None:
			self.__populateInfo(e)
	def __populateInfo(self, e):
		self.boardgamepublisher = []
		self.boardgamedesigner = []
		self.boardgamemechanic = []
		self.boardgamecategory = []
		for el in list(e):
			if hasattr(self, el.tag):
				if not el.tag in ('name', 'boardgamepublisher', 'boardgamedesigner', 'boardgamemechanic', 'boardgamecategory') or (el.tag == 'name' and el.attrib.get('primary')):
					setattr(self, el.tag, el.text)
				elif el.tag == 'boardgamepublisher':
					self.boardgamepublisher.append({'id': str(el.attrib['objectid']), 'name': el.text})
				elif el.tag == 'boardgamedesigner':
					self.boardgamedesigner.append({'id': str(el.attrib['objectid']), 'name': el.text})
				elif el.tag == 'boardgamemechanic':
					self.boardgamemechanic.append({'id': str(el.attrib['objectid']), 'name': el.text})
				elif el.tag == 'boardgamecategory':
					self.boardgamecategory.append({'id': str(el.attrib['objectid']), 'name': el.text})
			elif el.tag == "boardgameexpansion" and el.attrib.get('inbound') == "true":
				self.isExpansion = True
	def loadBoardGameGeekInfo(self):
		boardgameUrl = 'http://www.boardgamegeek.com/xmlapi/boardgame/'
		
		r = requests.get(boardgameUrl + str(self.objectid))
		b = ET.fromstring(r.text.encode('utf-8'))
		e = b.find('boardgame')
		self.__populateInfo(e)
	def isComplete(self):
		if (self.name != '' and int(self.yearpublished) != 0 and int(self.minplayers) != 0 and int(self.maxplayers) != 0 and self.crets != '' and int(self.playingtime) != 0 and self.boardgamepublisher and self.boardgamedesigner and self.thumbnail != '' and self.boardgamecategory and self.boardgamemechanic) or (self.yearpublished > 0 and self.yearpublished < 2010):
			return(True)
		else:
			return(False)

class BoardGameEncoder(json.JSONEncoder):
	def default(self, obj):
		if isinstance(obj, boardgame):
			d = {}
			for a in filter(lambda x: not '__' in x and not 'isComplete' in x and not 'loadBoardGameGeekInfo' in x and not 'reloadAttempt' in x, dir(obj)):
				d[a] = getattr(obj, a)
			return(d)

def BoardgameDecoder(dct):
	if 'objectid' in dct:
		bg = boardgame()
		for k, v in dct.iteritems():
			if hasattr(bg, k):
				setattr(bg, k, v)
		#Overwrite data for current date to allow for reruns
		bg.cnt = 0
		date_key = time.strftime("%Y-%m-%d")
		for geeklist in bg.geeklists:
			obj = filter(lambda x: x["date"] == date_key, geeklist["stats"])
			if obj:
				geeklist["stats"].remove(obj[0])
		return(bg)
	else:
		return(dct)

def loadList(geeklistid):
	if os.path.isfile(str(geeklistid) + '.txt'):
		f = open(str(geeklistid) + '.txt', 'r')
		bg = json.loads(f.read(), object_hook=BoardgameDecoder)
		f.close()
	else:
		bg = {}
	return(bg)

def main():
	#Set working directory
	os.chdir(os.path.dirname(__file__) or ".")
	
	#Load config
	f = open('geeklists.conf', 'r')
	lists = json.loads(f.read())
	f.close()
	
	date_key = time.strftime("%Y-%m-%d")
	
	#lists = []	
	for r in db.view('_design/geeklists/_view/geeklists', None, include_docs="true"):
		print r
		#lists.append({'id': r.id, 'name': r.key, r.update})
	
	#pdb.set_trace()

	boardgames = {}
	
	for geeklist in filter(lambda x: x["update"] == "true", lists):
		print 'Working on ' + str(geeklist["id"])
		geeklists = {}
		glStats = {'type': 'geekliststat', 'geeklistid': str(geeklist["id"]), 'date': date_key, 'bgCnt': 0, 'depth': 0, 'glCnt': 0, 'bgHistogram': []}
			
		extractBoardGames(geeklist["id"], geeklist["id"], geeklists, boardgames, glStats, 0)
		
		print "Saving..."	
		for bgId, bg in boardgames.iteritems():
			if bg.updated:
				bgJSON = json.loads(json.dumps(bg, cls=BoardGameEncoder))
				if bg._rev is None:
					del bgJSON["_rev"]
				id, rev = db.save(bgJSON)
				bg._rev = rev
				bg.updated = False
				#save boardgamestat [geeklistId, boardgameId, date]
		
		db.save(glStats)

dbUrl = 'http://%s:%s@%s:%s/' % (credentials['usr'], credentials['pw'], credentials['host'], credentials['port'])

server = couchdb.Server(url=dbUrl)
db = server['geeklistmon']

reloadStatic = ('reload' in sys.argv)
reloadNone = ('noreload' in sys.argv)

if reloadStatic:
	print "Reloading ALL"

if reloadNone:
	print "Reload disabled"

main()
