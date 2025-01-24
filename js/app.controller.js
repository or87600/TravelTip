import { utilService } from './services/util.service.js'
import { locService } from './services/loc.service.js'
import { mapService } from './services/map.service.js'

let currentRating = 0;
window.onload = onInit

// To make things easier in this project structure 
// functions that are called from DOM are defined on a global app object
window.app = {
    onRemoveLoc,
    onUpdateLoc,
    onSelectLoc,
    onPanToUserPos,
    onSearchAddress,
    onCopyLoc,
    onShareLoc,
    onSetSortBy,
    onSetFilterBy,
    setRating,
    resetStars,
    highlightStars
}

function onInit() {
    getFilterByFromQueryParams()
    loadAndRenderLocs()
    mapService.initMap()
        .then(() => {
            // onPanToTokyo()
            mapService.addClickListener(onAddLoc)
        })
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot init map')
        })
}

function renderLocs(locs) {
    const selectedLocId = getLocIdFromQueryParams()

    var strHTML = locs.map(loc => {
        const className = (loc.id === selectedLocId) ? 'active' : ''
        var distanceHTML = ''
        const userPos = mapService.getUserPosition()
        if (userPos) {
            const distance = utilService.getDistance(userPos, loc.geo)
            distanceHTML = `<span class="distance">Distance: ${distance} KM.</span>` 
        }
        
        return `
        <li class="loc ${className}" data-id="${loc.id}">
            <h4>  
                <span>${loc.name}</span>
                ${distanceHTML}
                <span title="${loc.rate} stars">${'★'.repeat(loc.rate)}</span>
            </h4>
            <p class="muted">
                Created: ${utilService.elapsedTime(loc.createdAt)}
                ${(loc.createdAt !== loc.updatedAt) ?
                ` | Updated: ${utilService.elapsedTime(loc.updatedAt)}`
                : ''}
            </p>
            <div class="loc-btns">     
               <button title="Delete" onclick="app.onRemoveLoc('${loc.id}')">🗑️</button>
               <button title="Edit" onclick="app.onUpdateLoc('${loc.id}')">✏️</button>
               <button title="Select" onclick="app.onSelectLoc('${loc.id}')">🗺️</button>
            </div>     
        </li>`}).join('')

    const elLocList = document.querySelector('.loc-list')
    elLocList.innerHTML = strHTML || 'No locs to show'

    renderLocStats()

    if (selectedLocId) {
        const selectedLoc = locs.find(loc => loc.id === selectedLocId)
        displayLoc(selectedLoc)
    }
    document.querySelector('.debug').innerText = JSON.stringify(locs, null, 2)
}

function onRemoveLoc(locId) {
    confirmDeleteModal()
        .then((isConfirmed) => {
            if (isConfirmed) {
                locService.remove(locId)
                    .then(() => {
                        flashMsg('Location removed')
                        unDisplayLoc()
                        loadAndRenderLocs()
                    })
                    .catch(err => {
                        console.error('OOPs:', err)
                        flashMsg('Cannot remove location')
                    })
            }
        })
}

function onSearchAddress(ev) {
    ev.preventDefault()
    const el = document.querySelector('[name=address]')
    mapService.lookupAddressGeo(el.value)
        .then(geo => {
            mapService.panTo(geo)
        })
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot lookup address')
        })
}

function onAddLoc(geo) {
    handleLocationModal({ name: geo.address || '', rate: 0 })
        .then(result => {
            if (result.isConfirmed) {
                const { name, rate } = result.value
                const loc = { name, rate, geo }

                locService.save(loc)
                    .then((savedLoc) => {
                        flashMsg(`Added Location (id: ${savedLoc.id})`)
                        utilService.updateQueryParams({ locId: savedLoc.id })
                        loadAndRenderLocs()
                    })
                    .catch(err => {
                        console.error('OOPs:', err)
                        flashMsg('Cannot add location')
                    })
            }
        })
}

function loadAndRenderLocs() {
    locService.query()
        .then(renderLocs)
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot load locations')
        })
}

function onPanToUserPos() {
    mapService.fetchUserPosition()
        .then(latLng => {
            mapService.panTo({ ...latLng, zoom: 15 })
            unDisplayLoc()
            mapService.setUserPosition(latLng)
            loadAndRenderLocs()
            flashMsg(`You are at Latitude: ${latLng.lat} Longitude: ${latLng.lng}`)
        })
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot get your position')
        })
}

function onUpdateLoc(locId) {
    locService.getById(locId)
        .then(loc => {
            handleLocationModal(loc)
                .then(result => {
                    if (result.isConfirmed) {
                        const updateLoc = result.value
                        if (updateLoc.name !== loc.name || updateLoc.rate !== loc.rate) {
                            loc.name = updateLoc.name
                            loc.rate = updateLoc.rate

                            locService.save(loc)
                                .then(savedLoc => {
                                    flashMsg(`Location updated: ${savedLoc.name}, Rate: ${savedLoc.rate}`);
                                    loadAndRenderLocs()
                                })
                                .catch(err => {
                                    console.error('OOPs:', err)
                                    flashMsg('Cannot update location')
                                })

                        }
                    }
                })
        })
        .catch(err => {
            console.error('Error fetching location:', err)
            flashMsg('Failed to load location data')
        })
}

function onSelectLoc(locId) {
    return locService.getById(locId)
        .then(displayLoc)
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot display this location')
        })
}

function displayLoc(loc) {
    document.querySelector('.loc.active')?.classList?.remove('active')
    document.querySelector(`.loc[data-id="${loc.id}"]`).classList.add('active')

    mapService.panTo(loc.geo)
    mapService.setMarker(loc)

    const el = document.querySelector('.selected-loc')
    el.querySelector('.loc-name').innerText = loc.name
    el.querySelector('.loc-address').innerText = loc.geo.address
    el.querySelector('.loc-rate').innerHTML = '★'.repeat(loc.rate)
    const userPosition = mapService.getUserPosition()
    if (userPosition) {
        const distance = utilService.getDistance(userPosition, loc.geo)
        el.querySelector('h4').innerHTML = `Distance: ${distance} KM.`
    }
    el.querySelector('[name=loc-copier]').value = window.location
    el.classList.add('show')

    utilService.updateQueryParams({ locId: loc.id })
}

function unDisplayLoc() {
    utilService.updateQueryParams({ locId: '' })
    document.querySelector('.selected-loc').classList.remove('show')
    mapService.setMarker(null)
}

function onCopyLoc() {
    const elCopy = document.querySelector('[name=loc-copier]')
    elCopy.select()
    elCopy.setSelectionRange(0, 99999) // For mobile devices
    navigator.clipboard.writeText(elCopy.value)
    flashMsg('Link copied, ready to paste')
}

function onShareLoc() {
    const url = document.querySelector('[name=loc-copier]').value

    // title and text not respected by any app (e.g. whatsapp)
    const data = {
        title: 'Cool location',
        text: 'Check out this location',
        url
    }
    navigator.share(data)
}

function flashMsg(msg) {
    const el = document.querySelector('.user-msg')
    el.innerText = msg
    el.classList.add('open')
    setTimeout(() => {
        el.classList.remove('open')
    }, 3000)
}

function getFilterByFromQueryParams() {
    const queryParams = new URLSearchParams(window.location.search)
    const txt = queryParams.get('txt') || ''
    const minRate = queryParams.get('minRate') || 0
    locService.setFilterBy({ txt, minRate })

    document.querySelector('input[name="filter-by-txt"]').value = txt
    document.querySelector('input[name="filter-by-rate"]').value = minRate
}

function getLocIdFromQueryParams() {
    const queryParams = new URLSearchParams(window.location.search)
    const locId = queryParams.get('locId')
    return locId
}

function onSetSortBy() {
    const prop = document.querySelector('.sort-by').value
    const isDesc = document.querySelector('.sort-desc').checked

    if (!prop) return

    const sortBy = {}
    sortBy[prop] = (isDesc) ? -1 : 1

    // Shorter Syntax:
    // const sortBy = {
    //     [prop] : (isDesc)? -1 : 1
    // }

    locService.setSortBy(sortBy)
    loadAndRenderLocs()
}

function onSetFilterBy({ txt, minRate }) {
    const filterBy = locService.setFilterBy({ txt, minRate: +minRate })
    utilService.updateQueryParams(filterBy)
    loadAndRenderLocs()
}

function renderLocStats() {
    Promise.all([
        locService.getLocCountByRateMap(),
        locService.getLocCountByLastUpdatedMap()
    ]).then(([rateStats, lastUpdatedStats]) => {
        handleStats(rateStats, 'loc-stats-rate');
        handleStats(lastUpdatedStats, 'loc-stats-last-updated');
    }).catch(error => {
        console.error('Error fetching location stats:', error);
    });
}


function handleStats(stats, selector) {
    // stats = { low: 37, medium: 11, high: 100, total: 148 }
    // stats = { low: 5, medium: 5, high: 5, baba: 55, mama: 30, total: 100 }
    const labels = cleanStats(stats)
    const colors = utilService.getColors()

    var sumPercent = 0
    var colorsStr = `${colors[0]} ${0}%, `
    labels.forEach((label, idx) => {
        if (idx === labels.length - 1) return
        const count = stats[label]
        const percent = Math.round((count / stats.total) * 100, 2)
        sumPercent += percent
        colorsStr += `${colors[idx]} ${sumPercent}%, `
        if (idx < labels.length - 1) {
            colorsStr += `${colors[idx + 1]} ${sumPercent}%, `
        }
    })

    colorsStr += `${colors[labels.length - 1]} ${100}%`
    // Example:
    // colorsStr = `purple 0%, purple 33%, blue 33%, blue 67%, red 67%, red 100%`

    const elPie = document.querySelector(`.${selector} .pie`)
    const style = `background-image: conic-gradient(${colorsStr})`
    elPie.style = style

    const ledendHTML = labels.map((label, idx) => {
        return `
                <li>
                    <span class="pie-label" style="background-color:${colors[idx]}"></span>
                    ${label} (${stats[label]})
                </li>
            `
    }).join('')

    const elLegend = document.querySelector(`.${selector} .legend`)
    elLegend.innerHTML = ledendHTML
}

function cleanStats(stats) {
    const cleanedStats = Object.keys(stats).reduce((acc, label) => {
        if (label !== 'total' && stats[label]) {
            acc.push(label)
        }
        return acc
    }, [])
    return cleanedStats
}

function confirmDeleteModal() {
    const swalWithBootstrapButtons = Swal.mixin({
        customClass: {
            confirmButton: "btn btn-success",
            cancelButton: "btn btn-danger"
        },
        buttonsStyling: true
    })

    return swalWithBootstrapButtons.fire({
        title: "Are you sure?",
        text: "You won't be able to revert this location!",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Yes, delete it!",
        cancelButtonText: "No, cancel!",
        reverseButtons: true
    })
    .then((result) => {
        if (result.isConfirmed) {
            swalWithBootstrapButtons.fire({
                title: "Deleted!",
                text: "Your location has been deleted.",
                icon: "success"
            });
            return true
        } else if (result.dismiss === Swal.DismissReason.cancel) {
            swalWithBootstrapButtons.fire({
                title: "Cancelled",
                text: "Your location is safe :)",
                icon: "error"
            })
            return false
        }
    })
}

function handleLocationModal(loc = { rate: '', name: '' }) {
    return Swal.fire({
        title: loc.rate === 0 ? 'Add New Location' : 'Update Location',
        html: `
            <div><label>Loc Name:</label></div>
            <input class="swal2-input" value="${loc.name}">
            
            <div><label>Rate:</label></div>
            <input class="swal2-input" type="number" min="1" max="5" value="${loc.rate}">
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonColor: 'darkslateblue',
        cancelButtonColor: 'darkmagenta',
        confirmButtonText: loc.rate === 0 ? 'Add' : 'Update',
        cancelButtonText: 'Cancel',
        showClass: {
            popup: 'animate__animated animate__fadeInDown'
        },
        hideClass: {
            popup: 'animate__animated animate__fadeOutUp'
        },
        
        preConfirm: () => {
            const popup = Swal.getPopup()
            const inputs = popup.querySelectorAll('.swal2-input')
            const name = inputs[0].value.trim() || loc.name
            const rate = Number(inputs[1].value) || loc.rate || 1

            if (rate < 1 || rate > 5) {
                Swal.showValidationMessage('Rate must be a number between 1 and 5')
                return false
            }

            return { name, rate }
        }
    })
}

function highlightStars(stars) {
    const starElements = document.querySelectorAll('.star')
    starElements.forEach((star, index) => {
        if (index < stars) {
            star.classList.add('filled')
        } else {
            star.classList.remove('filled')
        }
    })
}

function setRating(stars) {
    currentRating = stars
    document.querySelector('.star-rating-input').value = stars
    highlightStars(stars)
    
    // send rate to service
    onSetFilterBy({ minRate: stars })
}

function resetStars() {
    highlightStars(currentRating)
}