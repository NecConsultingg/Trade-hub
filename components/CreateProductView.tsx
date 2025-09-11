"use client"

import React, { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { PlusIcon, Trash2 } from "lucide-react";
import { getUserId } from '@/lib/userId';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import {Modal} from '@/components/ui/modal';

interface Attribute {
  name: string;
  options: string[];
}

export interface Product {
  name: string;
  image: string | null;
  attributes: Attribute[];
}

interface CreateProductViewProps {
  onSaveProduct: () => void;  
  onClose: () => void;
}

const CreateProductView: React.FC<CreateProductViewProps> = ({ onSaveProduct, onClose }) => {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [newProductId, setNewProductId] = useState<number|null>(null);
  const [productImage, setProductImage] = useState<string | null>(null);
  //const [fileName, setFileName] = useState("");
  const [productName, setProductName] = useState('');
  const [productNameError, setProductNameError] = useState('');
  //const [isDragging, setIsDragging] = useState(false);
  const [attributes, setAttributes] = useState<Attribute[]>([{ name: '', options: [''] }]);
  const [attributeErrors, setAttributeErrors] = useState<string[]>([]);


  useEffect(() => {
  const checkProductNameExists = async () => {
    const userId = await getUserId();

    if (productName.trim() === '') {
      setProductNameError('');
      return;
    }

    const { data, error } = await supabase
      .from('products')
      .select('id')
      .eq('user_id', userId)
      .eq('name', productName.trim());

    if (error) {
      console.error('Error checking product name:', error);
      return;
    }

    if (data && data.length > 0) {
      setProductNameError('Este nombre de producto ya existe.');
    } else {
      setProductNameError('');
    }
  };

  checkProductNameExists();
}, [productName]);

  const validateForm = () => {
    let valid = true;

    // Validar nombre de producto
    if (!productName.trim()) {
      setProductNameError('El nombre del producto es obligatorio.');
      valid = false;
    } else if (productName.length > 30) {
      setProductNameError('El nombre del producto no puede exceder los 30 caracteres.');
      valid = false;
    }else if (productNameError) {
      // Ya se encontró que existe, entonces no permitir
      valid = false;
    } else {
      setProductNameError('');
    }

    // Validar atributos
    const newAttrErrors = attributes.map(attr => {
      if (attr.name.trim() && attr.name.length > 20) {
        valid = false;
        return 'El nombre del atributo no puede exceder los 20 caracteres.';
      }
      if (attr.name.trim() && !attr.options.some(opt => opt.trim())) {
        valid = false;
        return 'Debe ingresar al menos una opción para este atributo.';
      }
      if (attr.options.some(opt => opt.length > 20)) {
        valid = false;
        return 'Las opciones no pueden exceder los 20 caracteres.';
      }
      return '';
    });
    setAttributeErrors(newAttrErrors);

    return valid;
  };

  const handleSaveProduct = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      const insertedId = await insertProduct(); 
      if (!insertedId) {
        console.error("No se pudo obtener el ID del producto");
        return;
      }

      const nonEmptyAttributes = attributes.filter(attribute => attribute.name.trim() !== '');
      if (nonEmptyAttributes.length > 0) {
        const attributesData = await insertAttribute(insertedId, nonEmptyAttributes);
        if (attributesData && attributesData.length > 0) {
          await insertOptions(attributesData, nonEmptyAttributes);
        }
      }

      // Reset form state
      setProductName('');
      setProductImage(null);
      setAttributes([{ name: '', options: [''] }]);
      setAttributeErrors([]);
      
      // abrimos nuestro modal y almacenamos el ID
      setNewProductId(insertedId);
      setShowModal(true);
      return;
      
    } catch (error) {
      console.error("Error al guardar el producto:", error);
    }
  };
  
  {/* IMAGE UPLOAD
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
  
    const allowedTypes = ["image/png", "image/jpeg"];
    if (!allowedTypes.includes(file.type)) {
      alert("Formato no permitido. Usa PNG o JPG ");
      return;
    }
  
    if (file.size > 10 * 1024 * 1024) {
      alert("El archivo supera los 10MB permitidos.");
      return;
    }
    setFileName(file.name);
    const imageUrl = URL.createObjectURL(file);
    setProductImage(imageUrl);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const processFile = (file: File) => {
    setProductImage(URL.createObjectURL(file));
    setFileName(file.name);
  };
  */}

  const removeAttribute = (index: number) => {
    setAttributes((prev) => prev.filter((_, i) => i !== index));
  };

  const removeOption = (attrIndex: number, optionIndex: number) => {
    setAttributes((prev) =>
      prev.map((attr, i) =>
        i === attrIndex
          ? { ...attr, options: attr.options.filter((_, j) => j !== optionIndex) }
          : attr
      )
    );
  };

  const handleAttributeNameChange = (index: number, value: string) => {
    const newAttributes = [...attributes];
    newAttributes[index].name = value;
    setAttributes(newAttributes);
  };

  const handleOptionChange = (attrIndex: number, optionIndex: number, value: string) => {
    const newAttributes = [...attributes];
    newAttributes[attrIndex].options[optionIndex] = value;
    setAttributes(newAttributes);
  };

  const addOption = (attrIndex: number) => {
    const newAttributes = [...attributes];
    newAttributes[attrIndex].options.push('');
    setAttributes(newAttributes);
  };

  const addAttribute = () => {
    setAttributes([...attributes, { name: '', options: [''] }]);
  };

  const [insertedId, setInsertedId] = useState(null);

  async function insertProduct() {
    try {
      const userId = await getUserId();
      const { data, error } = await supabase
        .from('products')
        .insert([{ user_id: userId, name: productName, description: ''}])
        .select('id');
  
      if (error) throw error;
  
      return data?.[0]?.id;
    } catch (error) {
      console.error('Error inserting product:', error);
    }
  }
  
  async function insertAttribute(productId: number, nonEmptyAttributes: Attribute[]) {
    try {
      // Insert all attributes at once and get back all their IDs
      const { data, error } = await supabase
        .from('product_characteristics')
        .insert(nonEmptyAttributes.map((attribute) => ({
          product_id: productId,
          name: attribute.name,
        })))
        .select('characteristics_id, name');
  
      if (error) throw error;
      return data; // Return all inserted attributes with their IDs
    } catch (error) {
      console.error('Error inserting attributes:', error);
      return [];
    }
  }
  
  async function insertOptions(attributesData: any[], nonEmptyAttributes: Attribute[]) {
    try {
      // Create an array to hold all options to be inserted
      const optionsToInsert: any[] = [];
      
      // For each attribute, find its corresponding ID and add its options
      for (let i = 0; i < attributesData.length; i++) {
        const attrData = attributesData[i];
        const attribute = nonEmptyAttributes.find(attr => attr.name === attrData.name);
        
        if (attribute) {
          // Add each non-empty option for this attribute with the correct characteristics_id
          attribute.options.forEach(option => {
            if (option.trim() !== '') {
              optionsToInsert.push({
                characteristics_id: attrData.characteristics_id,
                values: option
              });
            }
          });
        }
      }
      
      // Only insert if we have options
      if (optionsToInsert.length > 0) {
        const { error } = await supabase
          .from('characteristics_options')
          .insert(optionsToInsert);
  
        if (error) throw error;
        console.log("Inserted options successfully");
      }
    } catch (error) {
      console.error('Error inserting options:', error);
    }
  }
  
  

  return (
    <>
    <div className="h-full">
      <Card className="w-full max-w-3xl mx-auto">
        <CardContent className="p-6 ">
          <div className="flex flex-col md:flex-row justify-between items-start gap-4">
            <h1 className="text-lg font-semibold capitalize">Nuevo Producto</h1>
          </div>
          {/*
          <div
            className={`mt-4 flex-col items-center rounded-lg border border-dashed py-8 cursor-pointer transition-all ${
              isDragging ? "border-blue-500 bg-blue-100" : "border-gray-300"
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => document.getElementById("file-upload")?.click()}
          >
            <div className="text-center">
              {productImage ? (
                <div className="flex flex-col items-center">
                  <img
                    src={productImage}
                    alt="Preview"
                    className="w-24 h-24 object-cover rounded mb-2"
                  />
                  <p className="text-sm text-gray-500">{fileName}</p>
                  <div className="flex gap-2 mt-2">
                    <Button variant="destructive" onClick={() => setProductImage(null)}>
                      Eliminar
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <svg
                    className="mx-auto size-12 text-gray-300"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M1.5 6a2.25 2.25 0 0 1 2.25-2.25h16.5A2.25 2.25 0 0 1 22.5 6v12a2.25 2.25 0 0 1-2.25 2.25H3.75A2.25 2.25 0 0 1 1.5 18V6ZM3 16.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0 0 21 18v-1.94l-2.69-2.689a1.5 1.5 0 0 0-2.12 0l-.88.879.97.97a.75.75 0 1 1-1.06 1.06l-5.16-5.159a1.5 1.5 0 0 0-2.12 0L3 16.061Zm10.125-7.81a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0Z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <label className="cursor-pointer">
                    <span className="text-blue-500 text-sm mt-2">Sube la imagen</span>
                    <span className="text-sm text-gray-400 text-center">
                      o Arrastra la imagen
                    </span>
                    <p className="text-xs text-gray-600">PNG, JPG, hasta 10MB</p>
                    <input
                      id="file-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageUpload}
                    />
                  </label>
                </>
              )}
            </div>
          </div>
          */}
          <div className="space-y-2 my-6">

            <Label htmlFor="product-name">Nombre</Label>
            <Input
              id="product-name"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="Nombre del producto"
              maxLength={100}
            />
            {productNameError && (
              <p className="text-red-600 text-sm mt-1">{productNameError}</p>
            )}


            <div className="space-y-2">
              
            <div className="flex justify-between items-center mb-2">
              <Label htmlFor="product-name" className="text-base font-semibold">
                Detalles
              </Label>
              <Button
                type="button"
                variant="outline"
                onClick={addAttribute}
                className="text-sm"
              >
                <PlusIcon className="w-4 h-4 mr-2" />
                Agregar atributo
              </Button>
            </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {attributes.map((attribute, attrIndex) => (
              <Card key={attrIndex} className="p-4">
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor={`attribute-${attrIndex}`}>
                      Nombre del atributo {attrIndex + 1}
                    </Label>
                    <Input
                      id={`attribute-${attrIndex}`}
                      value={attribute.name}
                      onChange={(e) => handleAttributeNameChange(attrIndex, e.target.value)}
                      placeholder="Nombre del atributo"
                      maxLength={50}
                    />
                  </div>

                  {attribute.options.map((option, optionIndex) => (
                    <div key={optionIndex} className="flex items-center gap-2">
                      <div className="space-y-2 w-full">
                        <Label htmlFor={`option-${attrIndex}-${optionIndex}`}>
                          Opción {optionIndex + 1}
                        </Label>
                        <Input
                          id={`option-${attrIndex}-${optionIndex}`}
                          value={option}
                          onChange={(e) =>
                            handleOptionChange(attrIndex, optionIndex, e.target.value)
                          }
                          placeholder="Ingresar la opción"
                          maxLength={50}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => removeOption(attrIndex, optionIndex)}
                        className="ml-2 mt-5"
                      >
                        <Trash2 className="text-red-600" />
                      </Button>
                    </div>
                  ))}

                  {attributeErrors[attrIndex] && (
                    <p className="text-red-600 text-sm">{attributeErrors[attrIndex]}</p>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => addOption(attrIndex)}
                    className="w-full"
                  >
                    <PlusIcon className="w-4 h-4 mr-2" />
                    Agregar opción
                  </Button>

                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => removeAttribute(attrIndex)}
                    className="w-full"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Eliminar atributo
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

            </div>
          </div>

          <div className="flex justify-end gap-4 mt-8">
            <Button variant="outline" type="button" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSaveProduct}
              className="bg-blue-500 hover:bg-blue-600"
            >
              Agregar
            </Button>
          </div>
          {/* ———— Aquí insertas tu Modal personalizado ———— */}
        <Modal open={showModal} onClose={() => setShowModal(false)}>
          <h2 className="text-xl font-semibold mb-2">Producto creado</h2>
          <p className="mb-6 text-gray-600">¿Deseas agregar inventario de este producto?</p>
          <div className="flex flex-col gap-3">
            <Button
              onClick={() => {
                setShowModal(false);
                // Open location selector for this product
                router.push(`/dashboard/inventario/agregarinventario?productId=${newProductId}`);
              }}
              className="w-full bg-blue-500 hover:bg-blue-600"
            >
              Si
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowModal(false)}
              className="w-full"
            >
              En otro momento
            </Button>
            <Button
              variant="ghost"
              onClick={() => router.push('/dashboard/inventario')}
              className="w-full"
            >
              Volver al inventario
            </Button>
          </div>
        </Modal>
        </CardContent>
        
      </Card>
      
    </div>
    
  </>

  
  );
  
};

export default CreateProductView;