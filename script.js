// Variables globales
let currentHeading = 0;
let isCalibrating = false;
let calibrationOffset = 0;

// Elementos del DOM
const needle = document.getElementById('needle');
const headingDisplay = document.getElementById('heading');
const statusDisplay = document.getElementById('status');
const calibrateBtn = document.getElementById('calibrate-btn');

// ============================================
// FUNCIÓN PRINCIPAL: Manejar la orientación
// ============================================
function handleOrientation(event) {
    let heading;
    
    // Detectar si es iOS (Safari) o Android/otros
    if (event.webkitCompassHeading !== undefined) {
        // iOS: usa la propiedad específica de WebKit
        heading = event.webkitCompassHeading;
        // iOS también puede darnos la precisión
        if (event.webkitCompassAccuracy !== undefined) {
            const accuracy = event.webkitCompassAccuracy;
            if (accuracy < 0) {
                statusDisplay.textContent = '⚠️ Sensor no disponible';
                return;
            } else if (accuracy > 20) {
                statusDisplay.textContent = '🔄 Calibrando... mueve el teléfono en forma de 8';
            } else {
                statusDisplay.textContent = '✅ Brújula lista';
            }
        }
    } else if (event.alpha !== null) {
        // Android y otros: usa 'alpha' (0-360 grados)
        heading = event.alpha;
        // En algunos Android, 'alpha' puede ser respecto al norte magnético
        // pero a veces necesita ajuste
        if (event.absolute === true) {
            statusDisplay.textContent = '✅ Brújula lista (absoluta)';
        } else {
            statusDisplay.textContent = '✅ Brújula lista (relativa)';
        }
    } else {
        // No se pudo obtener el rumbo
        statusDisplay.textContent = '❌ Tu dispositivo no soporta brújula';
        return;
    }
    
    // Aplicar calibración manual si existe
    heading = (heading + calibrationOffset) % 360;
    if (heading < 0) heading += 360;
    
    // Guardar el valor actual
    currentHeading = heading;
    
    // Actualizar la aguja (la aguja apunta al norte)
    // La aguja está diseñada con la punta roja hacia arriba (Norte)
    // Por lo tanto, rotamos en sentido contrario al rumbo para que apunte al norte
    needle.style.transform = `translate(-50%, -100%) rotate(${-heading}deg)`;
    
    // Actualizar el display del rumbo
    headingDisplay.textContent = Math.round(heading);
}

// ============================================
// SOLICITAR PERMISO (necesario en iOS 13+)
// ============================================
async function requestPermission() {
    try {
        if (typeof DeviceOrientationEvent !== 'undefined' && 
            typeof DeviceOrientationEvent.requestPermission === 'function') {
            // iOS 13+ requiere permiso explícito
            const permissionState = await DeviceOrientationEvent.requestPermission();
            if (permissionState === 'granted') {
                statusDisplay.textContent = '✅ Permiso concedido';
                window.addEventListener('deviceorientation', handleOrientation, true);
                return true;
            } else {
                statusDisplay.textContent = '❌ Permiso denegado';
                return false;
            }
        } else {
            // Android y iOS antiguos: no necesitan permiso explícito
            window.addEventListener('deviceorientation', handleOrientation, true);
            statusDisplay.textContent = '✅ Brújula activa';
            return true;
        }
    } catch (error) {
        console.error('Error al solicitar permiso:', error);
        statusDisplay.textContent = '❌ Error al acceder al sensor';
        return false;
    }
}

// ============================================
// CALIBRACIÓN MANUAL
// ============================================
function calibrateCompass() {
    if (isCalibrating) return;
    isCalibrating = true;
    calibrateBtn.textContent = '🔄 Calibrando...';
    
    // Tomar varias lecturas y promediar
    let readings = [];
    const maxReadings = 10;
    let count = 0;
    
    const interval = setInterval(() => {
        if (currentHeading !== 0) {
            readings.push(currentHeading);
            count++;
            statusDisplay.textContent = `📊 Calibrando... ${count}/${maxReadings}`;
        }
        
        if (count >= maxReadings) {
            clearInterval(interval);
            
            // Calcular el promedio
            const avg = readings.reduce((a, b) => a + b, 0) / readings.length;
            
            // Si el promedio es cercano a 0, no hay offset
            // Si está cerca de 360, también es 0
            let offset = 0;
            if (avg > 10 && avg < 350) {
                // El usuario puede elegir "poner a cero" el rumbo actual
                offset = -avg;
                // Si el offset es negativo, sumamos 360
                while (offset < 0) offset += 360;
            }
            
            calibrationOffset = offset;
            isCalibrating = false;
            calibrateBtn.textContent = '🔄 Calibrar';
            statusDisplay.textContent = `✅ Calibrado (offset: ${Math.round(calibrationOffset)}°)`;
            
            // Actualizar inmediatamente
            const fakeEvent = { alpha: currentHeading, webkitCompassHeading: currentHeading };
            handleOrientation(fakeEvent);
        }
    }, 200);
}

// ============================================
// INICIAR LA BRÚJULA
// ============================================
async function init() {
    statusDisplay.textContent = '🔄 Iniciando brújula...';
    
    // Esperar un momento para que el dispositivo esté listo
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const success = await requestPermission();
    
    if (!success) {
        statusDisplay.textContent = '❌ No se pudo iniciar la brújula';
    }
}

// ============================================
// EVENTOS DE LA INTERFAZ
// ============================================
calibrateBtn.addEventListener('click', calibrateCompass);

// ============================================
// INICIAR TODO
// ============================================
init();

// Manejar errores
window.addEventListener('error', (e) => {
    console.error('Error:', e);
    statusDisplay.textContent = '❌ Error: ' + e.message;
});

// Mostrar mensaje en consola
console.log('🧭 Brújula Web iniciada');
console.log('📱 Abre esta página en tu teléfono para probarla');