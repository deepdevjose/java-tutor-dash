package com.javatutor;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.AfterEach;
import static org.junit.jupiter.api.Assertions.*;

import java.io.ByteArrayOutputStream;
import java.io.PrintStream;

class AppTest {
    private final ByteArrayOutputStream outputStreamCaptor = new ByteArrayOutputStream();
    private final PrintStream standardOut = System.out;

    @BeforeEach
    public void setUp() {
        System.setOut(new PrintStream(outputStreamCaptor));
    }

    @AfterEach
    public void tearDown() {
        System.setOut(standardOut);
    }

    @Test
    void testHolaMundo() {
        // Ejecutar el main
        App.main(new String[]{});
        
        // Verificar que imprima "Hola Mundo"
        String output = outputStreamCaptor.toString().trim();
        assertEquals("Hola Mundo", output, "El programa debe imprimir exactamente 'Hola Mundo'");
    }
}
